import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MarketplaceRefundJournal } from './marketplace-refund-journal';
import { MarketplaceJournalService } from './marketplace-journal.service';

export type VerifiedRefund = {id: string; paymentId: string; amountMinor: bigint; currency: string; status: 'processed'|'failed'|'pending'};
type Attempt = {id: string; providerPaymentId: string; amountMinor: bigint; currency: string; state: string; providerRefundId: string|null; leaseToken: string|null};

// Deliberately NOT registered in DI or routed. There is no producer or provider
// dispatcher until shipping/tax allocation and refund policy approvals exist.
// This repository never sends a refund. PROVIDER_CONFIRMED is not journal posting.
export class MarketplaceRefundWorkflow {
  constructor(private readonly prisma: PrismaService) {}
  private enabled() {
    if (process.env.MARKETPLACE_REFUND_WORKFLOW_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Marketplace refund workflow is not activated');
    }
  }
  async claim(id: string): Promise<Attempt|null> {
    this.enabled();
    const fence = randomUUID();
    const rows = await this.prisma.$queryRaw<Attempt[]>`
      UPDATE "MarketplaceRefundAttempt" SET state='SUBMITTING', "leaseToken"=${fence},
        "leaseUntil"=now()+interval '5 minutes', "updatedAt"=now()
      WHERE id=${id} AND state='PREPARED' RETURNING *`;
    return rows[0] ?? null;
  }
  async expireUnknown() {
    this.enabled();
    // A crashed/uncertain submission must be fetched/reconciled, never resent.
    return this.prisma.$executeRaw`UPDATE "MarketplaceRefundAttempt" SET state='UNKNOWN', "updatedAt"=now() WHERE state='SUBMITTING' AND "leaseUntil"<now()`;
  }
  async reconcile(id: string, fence: string, refundId: string, verify: (paymentId: string, refundId: string) => Promise<VerifiedRefund>) {
    this.enabled();
    const rows = await this.prisma.$queryRaw<Attempt[]>`SELECT * FROM "MarketplaceRefundAttempt" WHERE id=${id}`;
    const attempt=rows[0];
    if (!attempt || attempt.leaseToken!==fence || !['SUBMITTING','UNKNOWN','PROVIDER_CONFIRMED'].includes(attempt.state)) throw new ConflictException('Refund ownership fence rejected');
    const proof=await verify(attempt.providerPaymentId,refundId);
    if (!['processed','failed','pending'].includes(proof.status) || proof.id!==refundId || proof.paymentId!==attempt.providerPaymentId || proof.amountMinor!==attempt.amountMinor || proof.currency!==attempt.currency) throw new ConflictException('Refund provider evidence mismatch');
    if (attempt.state==='PROVIDER_CONFIRMED') {
      if (attempt.providerRefundId!==proof.id || proof.status!=='processed') throw new ConflictException('Refund replay conflict');
      return {alreadyConfirmed:true};
    }
    if (proof.status==='pending') return {pending:true};
    const state=proof.status==='processed'?'PROVIDER_CONFIRMED':'FAILED';
    const changed=await this.prisma.$executeRaw`UPDATE "MarketplaceRefundAttempt" SET state=${state}, "providerRefundId"=${proof.id}, "updatedAt"=now() WHERE id=${id} AND "leaseToken"=${fence} AND state IN ('SUBMITTING','UNKNOWN')`;
    if (changed!==1) throw new ConflictException('Refund changed concurrently; reconcile without resubmission');
    return {providerConfirmed:state==='PROVIDER_CONFIRMED',financialJournalPosted:false};
  }
  async reconcileAndPost(id:string,fence:string,refundId:string,verify:(paymentId:string,refundId:string)=>Promise<VerifiedRefund>) {
    const result=await this.reconcile(id,fence,refundId,verify);
    if(!('alreadyConfirmed' in result) && !('providerConfirmed' in result && result.providerConfirmed)) return result;
    // A crash after provider confirmation is recoverable: subsequent calls
    // re-fetch evidence then replay the same immutable journal keys.
    const posted=await new MarketplaceRefundJournal(this.prisma,new MarketplaceJournalService(this.prisma)).postConfirmed(id);
    return {...result,...posted};
  }
}
