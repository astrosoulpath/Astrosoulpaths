import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('shared capture order binding (isolated; no provider or database)', () => {
  const order = { id: 'local', razorpayOrderId: 'order_owned', status: PaymentStatus.PENDING,
    type: PaymentType.WALLET_RECHARGE, amount: new Prisma.Decimal(100), currency: 'INR' };
  const payment = { id: 'pay_owned', order_id: 'order_owned', amount: 10000, currency: 'INR' };
  function setup() {
    const service = new PaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const credit = jest.spyOn(service as any, 'handleCapturedWalletRecharge').mockResolvedValue({ status: 'success' });
    const capture = (o: any, p: any) => (service as any).handleCapturedPayment({ event: 'payment.reconciled' }, o, p);
    return { credit, capture };
  }
  it('rejects a different order even when amount and currency match', async () => {
    const { credit, capture } = setup();
    await expect(capture(order, { ...payment, order_id: 'order_other' })).rejects.toThrow('does not match');
    expect(credit).not.toHaveBeenCalled();
  });
  it.each(['', 'order_wrong', undefined])('rejects malformed payment reference %s', async id => {
    const { credit, capture } = setup();
    await expect(capture(order, { ...payment, id })).rejects.toThrow('does not match');
    expect(credit).not.toHaveBeenCalled();
  });
  it('does not accept an unrelated payment as a completed-order replay', async () => {
    const { credit, capture } = setup();
    await expect(capture({ ...order, status: PaymentStatus.SUCCESS }, { ...payment, order_id: 'order_other' })).rejects.toThrow('does not match');
    expect(credit).not.toHaveBeenCalled();
  });
  it('preserves valid fulfillment and idempotent completed-order behavior', async () => {
    const { credit, capture } = setup();
    expect((await capture(order, payment)).status).toBe('success');
    expect((await capture({ ...order, status: PaymentStatus.SUCCESS }, payment)).status).toBe('duplicate');
    expect(credit).toHaveBeenCalledTimes(1);
  });
});
