import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('shared capture order binding (isolated; no provider or database)', () => {
  const saved = {...process.env};
  beforeEach(() => {process.env.RAZORPAY_KEY_ID = 'rzp_test_synthetic';});
  afterEach(() => {process.env = {...saved};});
  const order = { id: 'local', razorpayOrderId: 'order_owned', status: PaymentStatus.PENDING,
    type: PaymentType.WALLET_RECHARGE, amount: new Prisma.Decimal(100), currency: 'INR', metadata: {providerMode: 'TEST'} };
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
  it.each([null, {providerMode: 'UNKNOWN'}, {providerMode: 'LIVE'}])('never fulfills an unknown or foreign-mode order %j', async metadata => {
    const {credit, capture} = setup();
    await expect(capture({...order, metadata}, payment)).rejects.toThrow('environment');
    expect(credit).not.toHaveBeenCalled();
  });
  it.each([null, {providerMode: 'UNKNOWN'}, {providerMode: 'LIVE'}])('does not query provider or reconcile an unknown/foreign mode %j', async metadata => {
    const service = new PaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const fetch = jest.spyOn(service as any, 'fetchOrderPaymentsFromRazorpay');
    await expect((service as any).reconcileKnownOrder({...order, metadata})).rejects.toThrow('environment');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('matching LIVE metadata and key alone never bypass default-off fulfillment gate', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_synthetic';
    delete process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED;
    const {credit, capture} = setup();
    await expect(capture({...order, metadata: {providerMode: 'LIVE'}}, payment)).rejects.toThrow('disabled');
    expect(credit).not.toHaveBeenCalled();
  });
});
