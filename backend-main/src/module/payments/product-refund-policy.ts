import { ConflictException } from '@nestjs/common';

export const PRODUCT_REFUND_POLICY = 'full-unspent-principal-and-subscription-v1';
export function minorUnits(value: unknown): number {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new ConflictException('Exact positive minor-unit amount required');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new ConflictException('Exact positive minor-unit amount required');
  return amount;
}

/** Proposed conservative policy; execution requires separately approved revision.
 * Full principal only, zero fees/taxes/bonus adjustments. No partial refunds.
 * Unknown product definitions, renewals and historical allocations are rejected. */
export function productRefundSnapshot(order: any, wallet?: any, ledger?: any[], subscription?: any) {
  const mode = order?.metadata?.providerMode;
  if (!order || order.status !== 'SUCCESS' || !/^[A-Z]{3}$/.test(order.currency ?? '') || !['TEST', 'LIVE'].includes(mode) ||
      !/^order_[A-Za-z0-9]+$/.test(order.razorpayOrderId ?? '') || !/^pay_[A-Za-z0-9]+$/.test(order.razorpayPaymentId ?? ''))
    throw new ConflictException('Owned captured payment with explicit provider mode required');
  const amountMinor = minorUnits(order.amount);
  if (order.type === 'WALLET_RECHARGE') {
    // Narrow unspent-only policy: a single owned credit, no spend/bonus/other history.
    if (!wallet || wallet.id !== order.walletId || wallet.userId !== order.userId || wallet.currency !== order.currency ||
        minorUnits(wallet.balance) !== amountMinor || minorUnits(wallet.paidBalance) !== amountMinor ||
        Number(wallet.freeBalance) !== 0 || Number(wallet.lockedBalance) !== 0 || ledger?.length !== 1 ||
        ledger[0].userId !== order.userId || ledger[0].walletId !== wallet.id || ledger[0].type !== 'RECHARGE' ||
        ledger[0].referenceId !== order.id || minorUnits(ledger[0].amount) !== amountMinor)
      throw new ConflictException('Entire unspent paid principal with no bonus or other history required');
    return {kind: 'WALLET' as const, amountMinor, currency: order.currency, walletId: wallet.id};
  }
  const plan = subscription?.subscriptionPlan;
  const professional = plan?.name === 'ASTROLOGER_KUNDLI_YEARLY' && order.currency === 'INR' && amountMinor === 350000 && plan.durationDays === 365;
  const horoscope = plan?.name === 'DAILY_HOROSCOPE_MONTHLY' && order.currency === 'USD' && amountMinor === 100 && plan.durationDays === 30;
  if (order.type !== 'SUBSCRIPTION' || (!professional && !horoscope) || subscription?.userId !== order.userId ||
      order.metadata?.subscriptionId !== subscription?.id || subscription?.subscriptionStatus !== 'ACTIVE' ||
      subscription?.razorpayPaymentId !== order.razorpayPaymentId || subscription?.razorpayOrderId !== order.razorpayOrderId ||
      subscription?.currency !== order.currency || minorUnits(subscription?.amount) !== amountMinor)
    throw new ConflictException('Owned ACTIVE canonical subscription and exact product terms required');
  return {kind: 'SUBSCRIPTION' as const, amountMinor, currency: order.currency, subscriptionId: subscription.id,
    subscriptionUpdatedAt: new Date(subscription.updatedAt).toISOString(), platformGrossReversalMinor: amountMinor, astrologerReversalMinor: 0};
}
