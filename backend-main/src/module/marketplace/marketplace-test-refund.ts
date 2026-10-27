import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { getRazorpayInstance } from '../../config/razorpay.config';
import { configuredPaymentMode } from '../payments/payment-creation-command';
import { MarketplaceRefundWorkflow } from './marketplace-refund-workflow';
import { refundComponents } from './marketplace-refund-journal';
import { randomUUID } from 'node:crypto';

/** Real provider adapter, restricted to a fresh synthetic-only database and Test keys.
 * Never accepts an amount from the caller, never submits an UNKNOWN attempt. */
export class MarketplaceTestRefund {
  constructor(private readonly db:PrismaService) {}
  async submit(id:string,actorUserId:string) {
    if(process.env.MARKETPLACE_TEST_REFUND_EXECUTION_ENABLED!=='true'||configuredPaymentMode()!=='TEST'||
       process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED!=='true'||process.env.MARKETPLACE_REFUND_POLICY_APPROVED!=='true')
      throw new ServiceUnavailableException('Isolated TEST refund execution is not activated');
    const scope=await this.db.$queryRaw<Array<{name:string;port:number}>>`SELECT current_database() AS name,inet_server_port() AS port`;
    if(scope.length!==1||scope[0].port!==16432||!/^asp_payment_operations_[a-f0-9]{12}$/.test(scope[0].name))
      throw new ServiceUnavailableException('Refund execution requires the designated disposable synthetic database');
    const rows=await this.db.$queryRaw<Array<{id:string;caseId:string;providerPaymentId:string;amountMinor:bigint;currency:string;policyRevision:string;componentSnapshot:unknown;providerOrderId:string}>>`
      SELECT a.id,a."caseId",a."providerPaymentId",a."amountMinor",a.currency,a."policyRevision",a."componentSnapshot",o."razorpayOrderId" AS "providerOrderId"
      FROM "MarketplaceRefundAttempt" a JOIN "MarketplaceOrderCase" c ON c.id=a."caseId"
      JOIN "MarketplaceOrder" o ON o.id=c."orderId" AND o."customerUserId"=c."customerUserId"
      WHERE a.id=${id} AND a.state='PREPARED' AND c.kind='REFUND' AND c.status='APPROVED'
        AND o."razorpayPaymentId"=a."providerPaymentId" AND o."paymentVerifiedAt" IS NOT NULL`;
    if(rows.length!==1)throw new ConflictException('Owned approved PREPARED refund required; never resubmit uncertain attempts');
    if(!process.env.MARKETPLACE_REFUND_POLICY_REVISION||rows[0].policyRevision!==process.env.MARKETPLACE_REFUND_POLICY_REVISION)
      throw new ConflictException('Refund policy revision must match its approved immutable intent');
    const intent=rows[0];refundComponents(intent.componentSnapshot,intent.amountMinor,intent.currency);
    const provider=getRazorpayInstance();
    const payment=await provider.payments.fetch(intent.providerPaymentId).catch(()=>{throw new ServiceUnavailableException('Provider payment evidence unavailable');});
    if(payment.id!==intent.providerPaymentId||payment.order_id!==intent.providerOrderId||payment.status!=='captured'||payment.currency!==intent.currency||
       typeof payment.amount!=='number'||typeof payment.amount_refunded!=='number'||!Number.isSafeInteger(payment.amount)||!Number.isSafeInteger(payment.amount_refunded)||
       BigInt(payment.amount)-BigInt(payment.amount_refunded)<intent.amountMinor)
      throw new ConflictException('Captured TEST payment and remaining refund amount must match the approved intent');
    const workflow=new MarketplaceRefundWorkflow(this.db);
    const claim=await workflow.claim(id);
    if(!claim?.leaseToken)throw new ConflictException('Refund was already claimed; reload without resubmission');
    const auditId=randomUUID();
    await this.db.$executeRaw`INSERT INTO "AdminFinanceAction"
      (id,"actorUserId",action,"referenceId","providerMode",reason,"requestKey",state,"updatedAt")
      VALUES (${auditId},${actorUserId},'REFUND_SUBMIT',${id},'TEST','Approved isolated synthetic refund',${'refund-submit:'+id},'STARTED',CURRENT_TIMESTAMP)`;
    await this.db.marketplaceCaseEvent.create({data:{caseId:intent.caseId,actorUserId,action:'TEST_REFUND_SUBMISSION_CLAIMED'}});
    try {
      const refund=await provider.payments.refund(intent.providerPaymentId,{amount:Number(intent.amountMinor),receipt:id,notes:{purpose:'isolated_synthetic_test'}});
      if(!/^rfnd_[A-Za-z0-9]+$/.test(refund.id))throw new ConflictException('Provider refund reference unavailable');
      // Preserve the provider reference before proof fetch/journal posting. An
      // accepted submission is not a completed refund or bank settlement.
      const receipt=JSON.stringify({refundId:refund.id,fence:claim.leaseToken,submission:'PROVIDER_REFERENCE_RETURNED',financialJournalPosted:false,bankSettlementVerified:false});
      await this.db.$executeRaw`UPDATE "AdminFinanceAction" SET state='SUCCEEDED',result=${receipt}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${auditId} AND state='STARTED'`;
      const result=await workflow.reconcileAndPost(id,claim.leaseToken!,refund.id,async()=>{
        const proof=await provider.refunds.fetch(refund.id);
        if(typeof proof.amount!=='number'||!Number.isSafeInteger(proof.amount)||!['processed','failed','pending'].includes(proof.status))throw new ConflictException('Invalid provider refund proof');
        return {id:proof.id,paymentId:proof.payment_id,amountMinor:BigInt(proof.amount),currency:proof.currency,status:proof.status as 'processed'|'failed'|'pending'};
      });
      await this.db.marketplaceCaseEvent.create({data:{caseId:intent.caseId,actorUserId,action:'TEST_REFUND_PROVIDER_RECONCILED'}});
      return {success:true,data:{...result,refundId:refund.id,bankSettlementVerified:false}};
    } catch {
      await this.db.$executeRaw`UPDATE "AdminFinanceAction" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${auditId} AND state='STARTED'`;
      await this.db.$executeRaw`UPDATE "MarketplaceRefundAttempt" SET state='UNKNOWN',"updatedAt"=CURRENT_TIMESTAMP
        WHERE id=${id} AND state='SUBMITTING' AND "leaseToken"=${claim.leaseToken}`;
      throw new ServiceUnavailableException('Refund outcome requires reconciliation. Do not submit another refund.');
    }
  }
}
