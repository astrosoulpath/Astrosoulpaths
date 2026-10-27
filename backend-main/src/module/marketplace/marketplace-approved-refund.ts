import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { configuredPaymentMode } from '../payments/payment-creation-command';
import { ApprovedRefundIntent, RazorpayRefundDispatcher, RefundSubmissionStore } from '../payments/razorpay-refund-dispatcher';
import { refundComponents } from './marketplace-refund-journal';
import { MarketplaceRefundWorkflow } from './marketplace-refund-workflow';

/** Default-off approved marketplace allocation adapter. Never used for wallet or
 * subscription refunds, which require their own approved reservation policies. */
export class MarketplaceApprovedRefund {
  constructor(private readonly db: PrismaService) {}
  async submit(id: string, actorId: string, reason: string) {
    const mode = configuredPaymentMode(), revision = process.env.MARKETPLACE_REFUND_POLICY_REVISION;
    if (process.env.MARKETPLACE_REFUND_EXECUTION_ENABLED !== 'true' || process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED !== 'true' ||
        process.env.MARKETPLACE_REFUND_POLICY_APPROVED !== 'true' || process.env.RAZORPAY_REFUNDS_ENABLED !== 'true' ||
        !revision || revision !== process.env.RAZORPAY_REFUND_POLICY_REVISION || mode === 'UNKNOWN' ||
        (mode === 'LIVE' && process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true'))
      throw new ServiceUnavailableException('Approved marketplace refund execution is not activated');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 500)
      throw new ConflictException('Valid refund reference and audited reason required');
    const actor = await this.db.user.findUnique({where: {id: actorId}, include: {role: true}});
    if (!actor?.isActive || actor.isBlocked || actor.role?.name !== 'ADMIN') throw new ForbiddenException('Active canonical Admin required');
    const rows = await this.db.$queryRaw<any[]>`SELECT a.*,o."razorpayOrderId" AS "orderId" FROM "MarketplaceRefundAttempt" a
      JOIN "MarketplaceOrderCase" c ON c.id=a."caseId" JOIN "MarketplaceOrder" o ON o.id=c."orderId" AND o."customerUserId"=c."customerUserId"
      WHERE a.id=${id} AND a.state='PREPARED' AND c.kind='REFUND' AND c.status='APPROVED'
        AND a."providerPaymentId"=o."razorpayPaymentId" AND o."paymentVerifiedAt" IS NOT NULL`;
    if (rows.length !== 1 || rows[0].policyRevision !== revision) throw new ConflictException('Owned approved immutable refund intent required');
    const row = rows[0];refundComponents(row.componentSnapshot, row.amountMinor, row.currency);
    if (row.amountMinor <= 0n || row.amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new ConflictException('Invalid refund amount');
    const intent: ApprovedRefundIntent = {id, paymentId: row.providerPaymentId, orderId: row.orderId,
      amountMinor: Number(row.amountMinor), currency: row.currency, providerMode: mode, policyRevision: revision};
    const fence = randomUUID(), auditId = randomUUID();
    const store: RefundSubmissionStore = {
      claimApproved: async (_intent, canonicalActor, auditedReason) => this.db.$transaction(async tx => {
        const active = await tx.user.findUnique({where: {id: canonicalActor}, include: {role: true}});
        if (!active?.isActive || active.isBlocked || active.role?.name !== 'ADMIN') throw new ForbiddenException('Active canonical Admin required');
        // Audit and ownership/state claim commit together. No claim survives a failed audit.
        const changed = await tx.$executeRaw`UPDATE "MarketplaceRefundAttempt" a SET state='SUBMITTING',"leaseToken"=${fence},
          "leaseUntil"=now()+interval '5 minutes',"updatedAt"=now()
          FROM "MarketplaceOrderCase" c,"MarketplaceOrder" o WHERE a.id=${id} AND a.state='PREPARED' AND a."caseId"=c.id
          AND c."orderId"=o.id AND c.kind='REFUND' AND c.status='APPROVED' AND c."customerUserId"=o."customerUserId"
          AND a."policyRevision"=${revision} AND a."providerPaymentId"=${intent.paymentId} AND o."razorpayOrderId"=${intent.orderId}
          AND a."amountMinor"=${BigInt(intent.amountMinor)} AND a.currency=${intent.currency} AND o."paymentVerifiedAt" IS NOT NULL`;
        if (changed !== 1) return false;
        await tx.$executeRaw`INSERT INTO "AdminFinanceAction"(id,"actorUserId",action,"referenceId","providerMode",reason,"requestKey",state,"updatedAt")
          VALUES(${auditId},${canonicalActor},'REFUND_SUBMIT',${id},${mode},${auditedReason},${'refund-submit:'+id},'STARTED',now())`;
        await tx.marketplaceCaseEvent.create({data: {caseId: row.caseId, actorUserId: canonicalActor, action: 'REFUND_SUBMISSION_CLAIMED'}});
        return true;
      }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable}),
      recordReference: async (_id, refundId) => {await this.db.$transaction(async tx => {
        const changed=await tx.$executeRaw`UPDATE "MarketplaceRefundAttempt" SET state='UNKNOWN',"providerRefundId"=${refundId},"updatedAt"=now()
          WHERE id=${id} AND state='SUBMITTING' AND "leaseToken"=${fence}`;
        if(changed!==1)throw new ConflictException('Refund claim changed; reconcile');
        const result=JSON.stringify({refundId,fence,submission:'PROVIDER_REFERENCE_RETURNED',financialApplied:false});
        await tx.$executeRaw`UPDATE "AdminFinanceAction" SET state='SUCCEEDED',result=${result}::jsonb,"updatedAt"=now() WHERE id=${auditId} AND state='STARTED'`;
      });},
      markUnknown: async () => {await this.db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "MarketplaceRefundAttempt" SET state='UNKNOWN',"updatedAt"=now() WHERE id=${id} AND state='SUBMITTING' AND "leaseToken"=${fence}`;
        await tx.$executeRaw`UPDATE "AdminFinanceAction" SET state='UNKNOWN',"updatedAt"=now() WHERE id=${auditId} AND state='STARTED'`;
      });},
    };
    const provider = getRazorpayInstance();
    const accepted = await new RazorpayRefundDispatcher(provider as any, store).submit(intent, actorId, reason);
    // Acceptance is separate from freshly fetched provider confirmation and journal posting.
    const result = await new MarketplaceRefundWorkflow(this.db).reconcileAndPost(id, fence, accepted.refundId, async () => {
      const proof = await provider.refunds.fetch(accepted.refundId).catch(() => {throw new ServiceUnavailableException('Refund reference saved; reconcile without resubmitting');});
      if (typeof proof.amount !== 'number' || !Number.isSafeInteger(proof.amount) || !['processed','pending','failed'].includes(proof.status)) throw new ConflictException('Invalid refund evidence');
      return {id: proof.id, paymentId: proof.payment_id, amountMinor: BigInt(proof.amount), currency: proof.currency, status: proof.status as 'processed'|'pending'|'failed'};
    });
    return {success: true, data: {...result, refundId: accepted.refundId, bankSettlementVerified: false}};
  }
}
