import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { configuredPaymentMode } from './payment-creation-command';

export type ApprovedRefundIntent = {
  id: string; paymentId: string; orderId: string; amountMinor: number; currency: string;
  providerMode: 'TEST' | 'LIVE'; policyRevision: string;
};
/** Product-specific repository must authorize canonical Admin, lock/validate owned
 * approved intent and its unspent/component reservation, then atomically claim
 * and append actor/reason audit. No caller-supplied amount may reach this port. */
export interface RefundSubmissionStore {
  claimApproved(intent: ApprovedRefundIntent, actorId: string, reason: string): Promise<boolean>;
  recordReference(intentId: string, refundId: string): Promise<void>;
  markUnknown(intentId: string): Promise<void>;
}
type Provider = {
  orders: {fetch(id: string): Promise<any>};
  payments: {fetch(id: string): Promise<any>; fetchMultipleRefund(id: string, options: {count: number}): Promise<any>;
    refund(id: string, options: {amount: number; receipt: string; speed: 'normal'}): Promise<any>};
};

/** Provider boundary only: does not approve policy, release holds, debit wallets,
 * cancel subscriptions, post reversal journals or report bank settlement. */
export class RazorpayRefundDispatcher {
  constructor(private readonly provider: Provider, private readonly store: RefundSubmissionStore) {}
  private available(intent: ApprovedRefundIntent) {
    if (process.env.RAZORPAY_REFUNDS_ENABLED !== 'true' ||
        process.env.RAZORPAY_REFUND_POLICY_REVISION !== intent.policyRevision || !intent.policyRevision ||
        configuredPaymentMode() !== intent.providerMode ||
        (intent.providerMode === 'LIVE' && process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true'))
      throw new ServiceUnavailableException('Reviewed refund policy, environment and execution gates are required');
  }
  async submit(intent: ApprovedRefundIntent, actorId: string, reason: string) {
    this.available(intent);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(intent.id) || !/^pay_[A-Za-z0-9]+$/.test(intent.paymentId) ||
        !/^order_[A-Za-z0-9]+$/.test(intent.orderId) || !/^[A-Z]{3}$/.test(intent.currency) ||
        !Number.isSafeInteger(intent.amountMinor) || intent.amountMinor <= 0 || !actorId ||
        reason.trim().length < 10 || reason.trim().length > 500)
      throw new ConflictException('Valid owned refund intent and audited reason required');
    let payment: any, order: any, refunds: any;
    try {
      [payment, order, refunds] = await Promise.all([
        this.provider.payments.fetch(intent.paymentId), this.provider.orders.fetch(intent.orderId),
        this.provider.payments.fetchMultipleRefund(intent.paymentId, {count: 100}),
      ]);
    } catch {throw new ServiceUnavailableException('Provider evidence unavailable; no refund submitted');}
    if (payment.id !== intent.paymentId || payment.order_id !== intent.orderId || order.id !== intent.orderId ||
        payment.status !== 'captured' || payment.captured !== true || order.status !== 'paid' ||
        payment.currency !== intent.currency || order.currency !== intent.currency ||
        !Number.isSafeInteger(payment.amount) || !Number.isSafeInteger(payment.amount_refunded) ||
        payment.amount_refunded < 0 || payment.amount - payment.amount_refunded < intent.amountMinor ||
        !Number.isSafeInteger(order.amount) || order.amount !== payment.amount ||
        !Array.isArray(refunds.items) || refunds.items.length >= 100 ||
        refunds.items.some((r: any) => r.receipt === intent.id || !['processed', 'failed'].includes(r.status)))
      throw new ConflictException('Captured order/refund evidence is mismatched or uncertain; reconcile without resubmission');
    // Provider queries are read-only. Exactly one durable, authorized claim wins
    // before POST. A false/failed claim cannot dispatch even if evidence is valid.
    this.available(intent);
    if (!await this.store.claimApproved(intent, actorId, reason.trim()))
      throw new ConflictException('Refund already claimed; inspect its audit and reconcile');
    try {
      this.available(intent);
      const refund = await this.provider.payments.refund(intent.paymentId, {
        amount: intent.amountMinor, receipt: intent.id, speed: 'normal',
      });
      if (!/^rfnd_[A-Za-z0-9]+$/.test(refund.id ?? '') || refund.payment_id !== intent.paymentId ||
          refund.amount !== intent.amountMinor || refund.currency !== intent.currency || refund.receipt !== intent.id ||
          !['pending', 'processed'].includes(refund.status)) throw new Error('Refund receipt mismatch');
      await this.store.recordReference(intent.id, refund.id);
      return {refundId: refund.id, status: 'PENDING_VERIFICATION', financialApplied: false, bankSettlementVerified: false};
    } catch {
      // Never retry POST, even when reference persistence or timeout fails.
      await this.store.markUnknown(intent.id).catch(() => undefined);
      throw new ServiceUnavailableException('Refund outcome uncertain; reservation retained. Reconcile, never resubmit automatically.');
    }
  }
}
