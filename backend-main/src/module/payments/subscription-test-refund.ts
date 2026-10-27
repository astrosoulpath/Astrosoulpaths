import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Explicit operator-only adapter. No HTTP route, worker or production activation.
 * Uses the same provider submit -> durable reference -> proof reconciliation
 * pattern as MarketplaceTestRefund, without inventing a marketplace order. */
export class SubscriptionTestRefund {
  constructor(private readonly db: PrismaService, private readonly provider: any) {}

  private async guard() {
    if (process.env.SUBSCRIPTION_TEST_REFUND_ENABLED !== 'true' ||
        !/^rzp_test_[A-Za-z0-9]+$/.test(process.env.RAZORPAY_KEY_ID || ''))
      throw new ServiceUnavailableException('TEST refund execution disabled');
    const [scope] = await this.db.$queryRaw<Array<{name:string;port:number}>>`SELECT current_database() AS name,inet_server_port() AS port`;
    if (!scope || scope.port !== 16432 || !/^asp_payment_operations_[a-f0-9]{12}$/.test(scope.name) ||
        scope.name !== process.env.SUBSCRIPTION_TEST_REFUND_DATABASE)
      throw new ServiceUnavailableException('Pinned isolated database required');
  }

  async prepare(paymentOrderId: string, subscriptionId: string) {
    await this.guard();
    const order = await this.db.paymentOrder.findUnique({where:{id:paymentOrderId}});
    const sub = await this.db.subscription.findUnique({where:{id:subscriptionId},include:{subscriptionPlan:true}});
    const meta = order?.metadata as any;
    if (!order || !sub || !order.userId.startsWith('synthetic-provider-astro-') || sub.userId !== order.userId ||
        order.status !== 'SUCCESS' || order.type !== 'SUBSCRIPTION' || meta?.providerMode !== 'TEST' || meta?.subscriptionId !== sub.id ||
        sub.subscriptionPlan?.name !== 'ASTROLOGER_KUNDLI_YEARLY' || sub.subscriptionStatus !== 'ACTIVE' ||
        order.amount.toString() !== '3500' || sub.amount?.toString() !== '3500' || order.currency !== 'INR' || sub.currency !== 'INR' ||
        !order.razorpayPaymentId || sub.razorpayPaymentId !== order.razorpayPaymentId)
      throw new ConflictException('Captured owned synthetic professional subscription required');
    const id = 'str_' + createHash('sha256').update(paymentOrderId).digest('hex').slice(0,32);
    await this.db.$transaction(async tx => {
      const added = await tx.$executeRaw`INSERT INTO "SubscriptionTestRefund"(id,"paymentOrderId","subscriptionId","providerPaymentId","amountMinor",currency,"policyRevision",state)
        VALUES(${id},${paymentOrderId},${subscriptionId},${order.razorpayPaymentId},350000,'INR','operator-test-full-refund-v1','PREPARED') ON CONFLICT("paymentOrderId") DO NOTHING`;
      if (added) await this.event(tx,id,'PREPARED_FULL_REFUND');
    });
    return id;
  }

  private async event(tx:any,id:string,action:string) {
    await tx.$executeRaw`INSERT INTO "SubscriptionTestRefundEvent"(id,"refundId",action,authority) VALUES(${randomUUID()},${id},${action},'LOCAL_OPERATOR_EXPLICIT_APPROVAL')`;
  }

  async submit(id:string) {
    await this.guard();
    const [intent] = await this.db.$queryRaw<any[]>`SELECT r.*,p."razorpayOrderId" FROM "SubscriptionTestRefund" r JOIN payment_orders p ON p.id=r."paymentOrderId" WHERE r.id=${id}`;
    if (!intent || intent.state !== 'PREPARED') throw new ConflictException('Never resubmit a claimed or uncertain refund');
    const payment = await this.provider.payments.fetch(intent.providerPaymentId);
    const refunds = await this.provider.payments.fetchMultipleRefund(intent.providerPaymentId,{count:100});
    if (payment.status !== 'captured' || payment.captured !== true || payment.order_id !== intent.razorpayOrderId ||
        payment.amount !== 350000 || payment.currency !== 'INR' || payment.amount_refunded !== 0 || refunds.items?.length !== 0)
      throw new ConflictException('Unrefunded captured TEST payment required');
    const claimed = await this.db.$transaction(async tx => {
      const n = await tx.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='SUBMITTING',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='PREPARED'`;
      if(n) await this.event(tx,id,'PROVIDER_SUBMISSION_CLAIMED');
      return n;
    });
    if (!claimed) throw new ConflictException('Another request already claimed refund');
    try {
      const refund = await this.provider.payments.refund(intent.providerPaymentId,{amount:350000,speed:'normal',receipt:id,notes:{purpose:'isolated_operator_approved_test'}});
      if (!/^rfnd_[A-Za-z0-9]+$/.test(refund.id)) throw new Error('Invalid provider reference');
      await this.db.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='PENDING',"providerRefundId"=${refund.id},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;
        await this.event(tx,id,'PROVIDER_REFERENCE_RECORDED');
      });
    } catch {
      await this.db.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;
      throw new ServiceUnavailableException('Refund outcome uncertain; reconcile without resubmission');
    }
    return this.reconcile(id);
  }

  async reconcile(id:string) {
    await this.guard();
    const [intent] = await this.db.$queryRaw<any[]>`SELECT * FROM "SubscriptionTestRefund" WHERE id=${id}`;
    if(!intent) throw new ConflictException('Unknown refund');
    if(intent.state==='PROCESSED') return {state:'PROCESSED',alreadyProcessed:true};
    if(!['SUBMITTING','UNKNOWN','PENDING'].includes(intent.state)) throw new ConflictException('Refund not submitted');
    let reference=intent.providerRefundId;
    if(!reference) {
      const collection=await this.provider.payments.fetchMultipleRefund(intent.providerPaymentId,{count:100});
      const matched=collection.items.filter((r:any)=>r.receipt===id && r.payment_id===intent.providerPaymentId && r.amount===350000 && r.currency==='INR');
      if(matched.length!==1) throw new ConflictException('Uncertain provider submission requires manual reconciliation; never resubmit');
      reference=matched[0].id;
      // A crash after claiming can leave SUBMITTING. Only reconcile proof, never dispatch again.
      if(intent.state==='SUBMITTING') await this.db.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='SUBMITTING'`;
      await this.db.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='PENDING',"providerRefundId"=${reference},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state='UNKNOWN'`;
    }
    const proof=await this.provider.refunds.fetch(reference);
    if(proof.id!==reference || proof.payment_id!==intent.providerPaymentId || proof.amount!==350000 || proof.currency!=='INR' || proof.receipt!==id || !['processed','pending','failed'].includes(proof.status))
      throw new ConflictException('Refund proof mismatch');
    if(proof.status==='pending') return {state:'PENDING',alreadyProcessed:false};
    if(proof.status==='failed') {
      await this.db.$transaction(async tx=>{const n=await tx.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='FAILED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id} AND state IN ('UNKNOWN','PENDING')`;if(n)await this.event(tx,id,'PROVIDER_FAILED_ENTITLEMENT_PRESERVED')});
      return {state:'FAILED',alreadyProcessed:false};
    }
    return this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "SubscriptionTestRefund" WHERE id=${id} FOR UPDATE`;
      const [current]=await tx.$queryRaw<any[]>`SELECT state FROM "SubscriptionTestRefund" WHERE id=${id}`;
      if(current.state==='PROCESSED') return {state:'PROCESSED',alreadyProcessed:true};
      if(!['PENDING','UNKNOWN'].includes(current.state)) throw new ConflictException('Invalid finalization state');
      const order=await tx.paymentOrder.findUnique({where:{id:intent.paymentOrderId}});
      const sub=await tx.subscription.findUnique({where:{id:intent.subscriptionId}});
      if(order?.status!=='SUCCESS' || sub?.subscriptionStatus!=='ACTIVE' || order.userId!==sub.userId || order.razorpayPaymentId!==intent.providerPaymentId || sub.razorpayPaymentId!==intent.providerPaymentId)
        throw new ConflictException('Entitlement changed; operator reconciliation required');
      await tx.$executeRaw`INSERT INTO "SubscriptionTestRefundAllocation"("refundId","platformGrossReversalMinor","astrologerReversalMinor",currency) VALUES(${id},350000,0,'INR')`;
      await tx.paymentOrder.update({where:{id:intent.paymentOrderId},data:{status:'REFUNDED'}});
      await tx.subscription.update({where:{id:intent.subscriptionId},data:{subscriptionStatus:'CANCELLED',cancelledAt:new Date()}});
      await tx.$executeRaw`UPDATE "SubscriptionTestRefund" SET state='PROCESSED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}`;
      await this.event(tx,id,'PROVIDER_PROCESSED_ALLOCATION_AND_ENTITLEMENT_COMMITTED');
      return {state:'PROCESSED',alreadyProcessed:false};
    });
  }
}
