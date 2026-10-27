import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MarketplaceTestRefund } from './marketplace-test-refund';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateMarketplaceCaseDto, ReviewMarketplaceCaseDto } from './dto/marketplace-case.dto';
import { MarketplaceRefundWorkflow } from './marketplace-refund-workflow';
import { ReconcileMarketplaceRefundDto } from './dto/reconcile-marketplace-refund.dto';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { randomUUID } from 'crypto';
import { refundComponents } from './marketplace-refund-journal';
import { PrepareMarketplaceRefundDto } from './dto/prepare-marketplace-refund.dto';
import { MarketplaceApprovedRefund } from './marketplace-approved-refund';
import { configuredPaymentMode } from '../payments/payment-creation-command';

@Injectable()
export class MarketplaceCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async submitApprovedRefund(subject: string, id: string, reason: string) {
    this.enabled();
    const admin = await this.actor(subject, true);
    return new MarketplaceApprovedRefund(this.prisma).submit(id, admin.id, reason);
  }

  async refundStatus(subject: string, id: string) {
    this.enabled();
    await this.actor(subject, true);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new BadRequestException('Invalid refund reference');
    const rows=await this.prisma.$queryRaw<any[]>`SELECT a.id,a.state,a."amountMinor",a.currency,a."providerRefundId",a."leaseToken",a."policyRevision",a."updatedAt",
      jsonb_array_length(a."componentSnapshot"->'allocations')::int AS "expectedEntries",
      (SELECT count(*)::int FROM "MarketplaceFinancialEntry" e WHERE e.kind='REFUND' AND e."eventKey"='refund:'||a.id||':'||e."sellerOrderId") AS "postedEntries"
      FROM "MarketplaceRefundAttempt" a WHERE a.id=${id}`;
    if(rows.length!==1)throw new NotFoundException('Refund attempt not found');
    const row=rows[0];
    const audit=await this.prisma.$queryRaw<any[]>`SELECT action,state,reason,"createdAt" FROM "AdminFinanceAction" WHERE "referenceId"=${id} ORDER BY "createdAt" DESC,id DESC LIMIT 50`;
    const {leaseToken,...visible}=row;
    return {success:true,data:{...visible,amountMinor:row.amountMinor.toString(),audit,
      reconciliation:row.providerRefundId&&leaseToken?{refundId:row.providerRefundId,fence:leaseToken}:null,
      submissionUncertain:row.state==='UNKNOWN'||row.state==='SUBMITTING',
      providerConfirmed:row.state==='PROVIDER_CONFIRMED',
      financialJournalPosted:row.state==='PROVIDER_CONFIRMED'&&row.expectedEntries>0&&row.postedEntries===row.expectedEntries,bankSettlement:'UNVERIFIED',
      canSubmit:row.state==='PREPARED'&&process.env.MARKETPLACE_REFUND_EXECUTION_ENABLED==='true'&&
        process.env.RAZORPAY_REFUNDS_ENABLED==='true'&&process.env.MARKETPLACE_REFUND_POLICY_APPROVED==='true'&&
        process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED==='true'&&row.policyRevision===process.env.MARKETPLACE_REFUND_POLICY_REVISION&&
        row.policyRevision===process.env.RAZORPAY_REFUND_POLICY_REVISION&&configuredPaymentMode()!=='UNKNOWN'&&
        (configuredPaymentMode()!=='LIVE'||process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED==='true'),
    }};
  }

  async submitTestRefund(subject:string,id:string) {
    this.enabled();
    const admin=await this.actor(subject,true);
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new ConflictException('Invalid refund reference');
    return new MarketplaceTestRefund(this.prisma).submit(id,admin.id);
  }

  private enabled() {
    if (process.env.MARKETPLACE_CASES_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Marketplace refund/dispute review is not enabled');
    }
  }
  async reconcileRefund(subject:string,id:string,dto:ReconcileMarketplaceRefundDto) {
    this.enabled();
    const admin=await this.actor(subject,true);
    const mode = configuredPaymentMode();
    if(process.env.MARKETPLACE_REFUND_RECONCILE_ENABLED!=='true' || mode==='UNKNOWN' ||
       (mode==='LIVE' && (process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED!=='true' || process.env.RAZORPAY_REFUNDS_ENABLED!=='true' || process.env.MARKETPLACE_REFUND_POLICY_APPROVED!=='true')))
      throw new ServiceUnavailableException('Approved refund reconciliation is not activated');
    const attempts=await this.prisma.$queryRaw<{caseId:string}[]>`SELECT "caseId" FROM "MarketplaceRefundAttempt" WHERE id=${id}`;
    if(attempts.length!==1) throw new NotFoundException('Refund attempt not found');
    await this.prisma.marketplaceCaseEvent.create({data:{caseId:attempts[0].caseId,actorUserId:admin.id,action:'REFUND_RECONCILE_REQUESTED'}});
    return new MarketplaceRefundWorkflow(this.prisma).reconcileAndPost(id,dto.fence,dto.refundId,async(paymentId,refundId)=>{
      const proof=await getRazorpayInstance().refunds.fetch(refundId).catch(()=>{
        throw new ServiceUnavailableException('Refund evidence unavailable; reconcile without resubmission');
      });
      if(typeof proof.amount!=='number' || !Number.isSafeInteger(proof.amount) || !['pending','processed','failed'].includes(proof.status)) throw new ConflictException('Invalid provider refund evidence');
      return {id:proof.id,paymentId:proof.payment_id,amountMinor:BigInt(proof.amount),currency:proof.currency,status:proof.status as 'pending'|'processed'|'failed'};
    });
  }
  async prepareRefund(subject:string,caseId:string,dto:PrepareMarketplaceRefundDto) {
    this.enabled();
    const admin=await this.actor(subject,true);
    const revision=process.env.MARKETPLACE_REFUND_POLICY_REVISION;
    if(process.env.MARKETPLACE_REFUND_POLICY_APPROVED!=='true' || process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED!=='true' || !revision || !/^[a-zA-Z0-9_.-]{1,100}$/.test(revision)) throw new ServiceUnavailableException('Approved refund allocation policy required');
    return this.prisma.$transaction(async tx=>{
      const cases=await tx.$queryRaw<{orderId:string;amountMinor:number;currency:string;razorpayPaymentId:string}[]>`
        SELECT c."orderId",c."amountMinor",c.currency,o."razorpayPaymentId" FROM "MarketplaceOrderCase" c
        JOIN "MarketplaceOrder" o ON o.id=c."orderId" AND o."customerUserId"=c."customerUserId"
        WHERE c.id=${caseId} AND c.kind='REFUND' AND c.status='APPROVED' AND o."paymentVerifiedAt" IS NOT NULL FOR UPDATE OF o,c`;
      const approved=cases[0];
      if(cases.length!==1 || !approved.razorpayPaymentId || !Number.isSafeInteger(approved.amountMinor) || approved.amountMinor<=0) throw new ConflictException('Approved captured refund case required');
      const snapshot={version:1,allocations:refundComponents({version:1,allocations:dto.allocations},BigInt(approved.amountMinor),approved.currency)};
      const attempts=await tx.$queryRaw<{id:string;caseId:string;amountMinor:bigint;currency:string;componentSnapshot:unknown;policyRevision:string}[]>`
        SELECT a.* FROM "MarketplaceRefundAttempt" a JOIN "MarketplaceOrderCase" c ON c.id=a."caseId" WHERE c."orderId"=${approved.orderId} AND a.state<>'FAILED'`;
      const existing=attempts.find(a=>a.caseId===caseId);
      if(existing) {
        const prior=refundComponents(existing.componentSnapshot,existing.amountMinor,existing.currency);
        if(existing.policyRevision!==revision || JSON.stringify(prior)!==JSON.stringify(snapshot.allocations)) throw new ConflictException('Refund intent replay mismatch');
        return {id:existing.id,alreadyPrepared:true};
      }
      const captures=await tx.$queryRaw<{sellerOrderId:string;productMinor:bigint;shippingMinor:bigint;taxMinor:bigint}[]>`
        SELECT e."sellerOrderId",e."productMinor",e."shippingMinor",e."taxMinor" FROM "MarketplaceFinancialEntry" e
        JOIN "MarketplaceSellerOrder" s ON s.id=e."sellerOrderId" WHERE s."orderId"=${approved.orderId} AND e.kind='CAPTURE' AND e.currency=${approved.currency}`;
      const reserved=[...snapshot.allocations,...attempts.flatMap(a=>refundComponents(a.componentSnapshot,a.amountMinor,a.currency))];
      for(const part of snapshot.allocations) {
        const capture=captures.find(c=>c.sellerOrderId===part.sellerOrderId);
        if(!capture) throw new ConflictException('Refund requires owned capture journal');
        for(const key of ['productMinor','shippingMinor','taxMinor'] as const) {
          const sum=reserved.filter(r=>r.sellerOrderId===part.sellerOrderId).reduce((total,r)=>total+BigInt(r[key]),0n);
          if(sum>capture[key]) throw new ConflictException('Refund exceeds unreserved component balance');
        }
      }
      const id=randomUUID(),payload=JSON.stringify(snapshot);
      await tx.$executeRaw`INSERT INTO "MarketplaceRefundAttempt" (id,"caseId","providerPaymentId","amountMinor",currency,"policyRevision","componentSnapshot") VALUES (${id},${caseId},${approved.razorpayPaymentId},${BigInt(approved.amountMinor)},${approved.currency},${revision},${payload}::jsonb)`;
      await tx.marketplaceCaseEvent.create({data:{caseId,actorUserId:admin.id,action:'REFUND_INTENT_PREPARED'}});
      return {id,alreadyPrepared:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async actor(subject: string, admin = false) {
    const identity = await this.prisma.userAuthIdentity.findUnique({
      where: { provider_providerUserId: { provider: 'supabase', providerUserId: subject } },
      select: { userId: true },
    });
    const user = await this.prisma.user.findUnique({
      where: identity ? { id: identity.userId } : { supabaseId: subject },
      include: { role: true },
    });
    if (identity) {
      const legacy = await this.prisma.user.findUnique({where:{supabaseId:subject},select:{id:true}});
      if (legacy && legacy.id !== identity.userId) throw new ForbiddenException('Conflicting marketplace identity');
    }
    if (!user || !user.isActive || user.isBlocked || (admin && user.role?.name.toUpperCase() !== 'ADMIN')) {
      throw new ForbiddenException('Marketplace access denied');
    }
    return user;
  }

  async create(subject: string, orderId: string, dto: CreateMarketplaceCaseDto) {
    this.enabled();
    const user = await this.actor(subject);
    return this.prisma.$transaction(async tx => {
      const order = await tx.marketplaceOrder.findFirst({ where: { id: orderId, customerUserId: user.id } });
      if (!order) throw new NotFoundException('Marketplace order not found');
      if (!order.paymentVerifiedAt || !['CONFIRMED', 'PROCESSING', 'COMPLETED'].includes(order.status)) {
        throw new ConflictException('Only verified paid orders support review');
      }
      const existing = await tx.marketplaceOrderCase.findUnique({
        where: { customerUserId_idempotencyKey: { customerUserId: user.id, idempotencyKey: dto.idempotencyKey } },
      });
      if (existing) {
        if (existing.orderId !== orderId || existing.kind !== dto.kind || existing.amountMinor !== (dto.amountMinor ?? null) || existing.reason !== dto.reason.trim()) {
          throw new ConflictException('Idempotency key belongs to another request');
        }
        return { success: true, data: existing };
      }
      if (dto.kind === 'REFUND') {
        if (order.currency !== 'INR' || !Number.isSafeInteger(dto.amountMinor) || dto.amountMinor! <= 0) {
          throw new BadRequestException('A positive INR minor-unit refund amount is required');
        }
        const pending = await tx.marketplaceOrderCase.aggregate({
          where: { orderId, kind: 'REFUND', status: { not: 'REJECTED' } }, _sum: { amountMinor: true },
        });
        if (new Prisma.Decimal(dto.amountMinor!).add(pending._sum.amountMinor ?? 0).gt(order.grandTotal.mul(100))) {
          throw new ConflictException('Refund review total exceeds paid order amount');
        }
      } else if (dto.amountMinor !== undefined) {
        throw new BadRequestException('Disputes do not transfer money');
      }
      const data = await tx.marketplaceOrderCase.create({ data: {
        orderId, customerUserId: user.id, kind: dto.kind, currency: order.currency,
        amountMinor: dto.amountMinor, reason: dto.reason.trim(), idempotencyKey: dto.idempotencyKey,
        events: { create: { actorUserId: user.id, action: 'REQUESTED' } },
      } });
      return { success: true, data };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async list(subject: string, admin = false) {
    this.enabled();
    const user = await this.actor(subject, admin);
    return { success: true, data: await this.prisma.marketplaceOrderCase.findMany({
      where: admin ? {} : { customerUserId: user.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100,
      include: { events: { orderBy: { createdAt: 'asc' } } },
    }) };
  }

  async review(subject: string, id: string, dto: ReviewMarketplaceCaseDto) {
    this.enabled();
    const admin = await this.actor(subject, true);
    return this.prisma.$transaction(async tx => {
      const existing = await tx.marketplaceOrderCase.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Marketplace case not found');
      if (existing.status === dto.status) return { success: true, data: existing };
      if (existing.status !== 'REQUESTED' || (dto.status === 'RESOLVED' && existing.kind !== 'DISPUTE') || (dto.status === 'APPROVED' && existing.kind === 'DISPUTE')) {
        throw new ConflictException('Invalid marketplace review transition');
      }
      const changed = await tx.marketplaceOrderCase.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: dto.status } });
      if (changed.count !== 1) throw new ConflictException('Marketplace case changed concurrently');
      await tx.marketplaceCaseEvent.create({ data: { caseId: id, actorUserId: admin.id, action: dto.status } });
      return { success: true, data: await tx.marketplaceOrderCase.findUnique({ where: { id } }), providerRefundExecuted: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
