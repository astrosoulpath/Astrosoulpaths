import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { configuredPaymentMode } from './payment-creation-command';
import { ApprovedRefundIntent, RazorpayRefundDispatcher, RefundSubmissionStore } from './razorpay-refund-dispatcher';
import { minorUnits, PRODUCT_REFUND_POLICY, productRefundSnapshot } from './product-refund-policy';

/** Append-only events use the existing protected AdminFinanceAction table. No
 * migration, broad seed, production policy approval or automatic worker implied.
 * Each event is inserted STARTED and finalized in one transaction. */
@Injectable()
export class ProductRefundService {
  constructor(private readonly db: PrismaService) {}
  private gate() {
    const mode = configuredPaymentMode();
    if (process.env.PAYMENT_CREATION_SCHEMA_READY !== 'true' || process.env.PRODUCT_REFUND_SCHEMA_READY !== 'true' || process.env.PRODUCT_REFUND_EXECUTION_ENABLED !== 'true' ||
        process.env.PRODUCT_REFUND_POLICY_APPROVED !== 'true' || process.env.RAZORPAY_REFUNDS_ENABLED !== 'true' ||
        process.env.RAZORPAY_REFUND_POLICY_REVISION !== PRODUCT_REFUND_POLICY || mode === 'UNKNOWN' ||
        (mode === 'LIVE' && process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true'))
      throw new ServiceUnavailableException('Approved product refund policy and execution gates required');
    return mode;
  }
  private input(orderId: string, reason: unknown) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId) || typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 500)
      throw new ConflictException('Valid order and audited reason (10–500 characters) required');
    return reason.trim();
  }
  private id(orderId: string) {return 'prf_' + createHash('sha256').update(orderId).digest('hex').slice(0,32);}
  private async admin(tx: any, actor: string) {
    const u = await tx.user.findUnique({where:{id:actor},include:{role:true}});
    if (!u?.isActive || u.isBlocked || u.role?.name !== 'ADMIN') throw new ForbiddenException('Active canonical Admin required');
  }
  private event(tx: any, id: string, phase: string) {return tx.adminFinanceAction.findUnique({where:{requestKey:`${id}:${phase}`}});}
  private async append(tx: any, id: string, orderId: string, phase: string, actor: string, reason: string, mode: string, result: any) {
    const row = await tx.adminFinanceAction.create({data:{id:randomUUID(),actorUserId:actor,action:phase==='CLAIMED'?'REFUND_SUBMIT':'REFUND_RECONCILE',
      referenceId:orderId,providerMode:mode,reason,requestKey:`${id}:${phase}`,state:'STARTED'}});
    await tx.adminFinanceAction.update({where:{id:row.id},data:{state:'SUCCEEDED',result}});
  }
  private transaction<T>(body:(tx:any)=>Promise<T>) {
    return this.db.$transaction(body,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  private async lock(tx:any, orderId:string) {
    await tx.$queryRaw`SELECT id FROM payment_orders WHERE id=${orderId} FOR UPDATE`;
    return tx.paymentOrder.findUnique({where:{id:orderId}});
  }
  async prepare(actor:string, orderId:string, reason:unknown) {
    const mode=this.gate(),why=this.input(orderId,reason),id=this.id(orderId);
    return this.transaction(async tx=>{
      await this.admin(tx,actor);const order=await this.lock(tx,orderId);
      const prior=await this.event(tx,id,'PREPARED');if(prior)return {id,state:'PREPARED_OR_LATER',alreadyPrepared:true};
      if(order?.metadata?.providerMode!==mode)throw new ConflictException('Payment environment mismatch');
      let wallet:any,ledger:any[],sub:any;
      if(order.type==='WALLET_RECHARGE') {
        await tx.$queryRaw`SELECT id FROM wallets WHERE id=${order.walletId} FOR UPDATE`;
        wallet=await tx.wallet.findUnique({where:{id:order.walletId}});
        ledger=await tx.walletLedger.findMany({where:{walletId:order.walletId}});
      } else {
        const subId=order.metadata?.subscriptionId;
        if(typeof subId!=='string')throw new ConflictException('Owned subscription required');
        await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id=${subId} FOR UPDATE`;
        sub=await tx.subscription.findUnique({where:{id:subId},include:{subscriptionPlan:true}});
        if(sub?.subscriptionPlan?.name==='ASTROLOGER_KUNDLI_YEARLY') {
          const owner=await tx.user.findUnique({where:{id:order.userId},include:{role:true}});
          if(owner?.role?.name!=='ASTROLOGER')throw new ConflictException('Professional subscription owner must be astrologer');
        }
      }
      const snapshot=productRefundSnapshot(order,wallet,ledger!,sub);
      // Holds block spending via existing wallet availability contract. Never move money at prepare.
      if(snapshot.kind==='WALLET')await tx.wallet.update({where:{id:snapshot.walletId},data:{lockedBalance:{increment:order.amount}}});
      const intent={id,paymentId:order.razorpayPaymentId,orderId:order.razorpayOrderId,amountMinor:snapshot.amountMinor,
        currency:snapshot.currency,providerMode:mode,policyRevision:PRODUCT_REFUND_POLICY};
      await this.append(tx,id,orderId,'PREPARED',actor,why,mode,{intent,snapshot,userId:order.userId});
      return {id,state:'PREPARED',financialApplied:false};
    });
  }
  async submit(actor:string, orderId:string, reason:unknown) {
    const mode=this.gate(),why=this.input(orderId,reason),id=this.id(orderId);
    await this.admin(this.db,actor);
    const prepared=await this.event(this.db,id,'PREPARED'),data=prepared?.result as any;
    if(!data?.intent||data.intent.providerMode!==mode)throw new ConflictException('Prepared owned refund required');
    const intent=data.intent as ApprovedRefundIntent;
    const store:RefundSubmissionStore={
      claimApproved:async()=>this.transaction(async tx=>{
        this.gate();await this.admin(tx,actor);const order=await this.lock(tx,orderId);
        if(await this.event(tx,id,'CLAIMED'))return false;
        if(order?.status!=='SUCCESS'||order.userId!==data.userId||order.razorpayPaymentId!==intent.paymentId||order.razorpayOrderId!==intent.orderId||
           order.metadata?.providerMode!==mode||minorUnits(order.amount)!==intent.amountMinor||order.currency!==intent.currency)
          throw new ConflictException('Prepared payment changed');
        await this.validateReservation(tx,data);
        await this.append(tx,id,orderId,'CLAIMED',actor,why,mode,{providerSubmitClaimed:true});return true;
      }),
      recordReference:async(_id,refundId)=>this.transaction(async tx=>{
        await this.lock(tx,orderId);await this.append(tx,id,orderId,'REFERENCE',actor,why,mode,{refundId,financialApplied:false});
      }),
      markUnknown:async()=>this.transaction(async tx=>{
        await this.lock(tx,orderId);if(!await this.event(tx,id,'UNKNOWN'))await this.append(tx,id,orderId,'UNKNOWN',actor,why,mode,{holdRetained:true});
      }),
    };
    return new RazorpayRefundDispatcher(getRazorpayInstance() as any,store).submit(intent,actor,why);
  }
  private async validateReservation(tx:any,data:any) {
    const s=data.snapshot;
    if(s.kind==='WALLET') {
      await tx.$queryRaw`SELECT id FROM wallets WHERE id=${s.walletId} FOR UPDATE`;
      const w=await tx.wallet.findUnique({where:{id:s.walletId}});
      if(!w||w.userId!==data.userId||w.currency!==s.currency||minorUnits(w.balance)!==s.amountMinor||
         minorUnits(w.paidBalance)!==s.amountMinor||minorUnits(w.lockedBalance)!==s.amountMinor||Number(w.freeBalance)!==0)
        throw new ConflictException('Wallet reservation drift; hold retained for manual reconciliation');
    } else {
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id=${s.subscriptionId} FOR UPDATE`;
      const sub=await tx.subscription.findUnique({where:{id:s.subscriptionId}});
      if(!sub||sub.userId!==data.userId||sub.subscriptionStatus!=='ACTIVE'||sub.razorpayPaymentId!==data.intent.paymentId||
         new Date(sub.updatedAt).toISOString()!==s.subscriptionUpdatedAt)
        throw new ConflictException('Entitlement changed or renewed; manual reconciliation required');
    }
  }
  async reconcile(actor:string,orderId:string,reason:unknown) {
    const mode=this.gate(),why=this.input(orderId,reason),id=this.id(orderId);
    await this.admin(this.db,actor);
    const prepared=await this.event(this.db,id,'PREPARED'),data=prepared?.result as any;
    if(!data?.intent||data.intent.providerMode!==mode||!await this.event(this.db,id,'CLAIMED'))throw new ConflictException('Claimed owned refund required');
    const provider=getRazorpayInstance();
    const ref=await this.event(this.db,id,'REFERENCE');let refundId=(ref?.result as any)?.refundId;
    if(!refundId) {
      const list:any=await provider.payments.fetchMultipleRefund(data.intent.paymentId,{count:100});
      if(!Array.isArray(list.items)||list.items.length>=100)throw new ConflictException('Uncertain refund list; never resubmit');
      const matches=list.items.filter((r:any)=>r.receipt===id&&r.payment_id===data.intent.paymentId&&r.amount===data.intent.amountMinor&&r.currency===data.intent.currency);
      if(matches.length!==1)throw new ConflictException('Uncertain provider outcome; hold retained, never resubmit');
      refundId=matches[0].id;
    }
    const proof:any=await provider.refunds.fetch(refundId);
    if(!/^rfnd_[A-Za-z0-9]+$/.test(refundId)||proof.id!==refundId||proof.receipt!==id||proof.payment_id!==data.intent.paymentId||
       proof.amount!==data.intent.amountMinor||proof.currency!==data.intent.currency||!['pending','processed','failed'].includes(proof.status))
      throw new ConflictException('Provider proof mismatch; reservation retained');
    if(proof.status==='pending')return {state:'PENDING',financialApplied:false};
    return this.transaction(async tx=>{
      this.gate();await this.admin(tx,actor);const order=await this.lock(tx,orderId);
      const final=await this.event(tx,id,'FINAL');if(final)return {...final.result,alreadyProcessed:true};
      if(order?.status!=='SUCCESS'||order.userId!==data.userId||order.razorpayPaymentId!==data.intent.paymentId||
         order.razorpayOrderId!==data.intent.orderId||order.metadata?.providerMode!==mode||minorUnits(order.amount)!==data.intent.amountMinor||order.currency!==data.intent.currency)
        throw new ConflictException('Payment changed; manual reconciliation required');
      await this.validateReservation(tx,data);const s=data.snapshot,processed=proof.status==='processed';
      if(s.kind==='WALLET') {
        const amount=new Prisma.Decimal(s.amountMinor).div(100);
        await tx.wallet.update({where:{id:s.walletId},data:processed?{balance:{decrement:amount},paidBalance:{decrement:amount},lockedBalance:{decrement:amount}}:{lockedBalance:{decrement:amount}}});
        if(processed)await tx.walletLedger.create({data:{walletId:s.walletId,userId:data.userId,type:'RECHARGE_REFUND',amount,
          balanceBefore:amount,balanceAfter:0,referenceId:id,referenceType:'REFUND',description:'Approved full unspent principal refund'}});
      } else if(processed)await tx.subscription.update({where:{id:s.subscriptionId},data:{subscriptionStatus:'CANCELLED',cancelledAt:new Date()}});
      if(processed)await tx.paymentOrder.update({where:{id:orderId},data:{status:'REFUNDED'}});
      const result={state:processed?'PROCESSED':'FAILED',refundId,financialApplied:processed,bankSettlementVerified:false,
        platformGrossReversalMinor:s.kind==='SUBSCRIPTION'&&processed?s.amountMinor:0,astrologerReversalMinor:0};
      await this.append(tx,id,orderId,'FINAL',actor,why,mode,result);return result;
    });
  }
}
