import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentsService } from './payments.service';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';
import { verifyCheckoutSignature } from './razorpay-verification.service';
import { getRazorpayInstance } from '../../config/razorpay.config';

jest.mock('../../config/razorpay.config', () => ({ getRazorpayInstance: jest.fn() }));

describe('checkout proof before fulfillment (isolated mocks)', () => {
  const saved = { ...process.env };
  const sign = (o = 'order_owned', p = 'pay_owned') =>
    createHmac('sha256', 'synthetic-api-secret').update(`${o}|${p}`).digest('hex');
  let service: PaymentsService;
  let order: any;
  let payment: any;
  let fetchPayment: jest.Mock;
  let fulfill: jest.SpyInstance;
  const proof = () => ({ orderId: 'order_owned', paymentId: 'pay_owned', signature: sign() });

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_synthetic';
    process.env.RAZORPAY_KEY_SECRET = 'synthetic-api-secret';
    order = { id: 'local', userId: 'customer', razorpayOrderId: 'order_owned', status: 'PENDING',
      amount: new Prisma.Decimal('100'), currency: 'INR', metadata: { providerMode: 'TEST' } };
    payment = { id: 'pay_owned', order_id: 'order_owned', amount: 10000, currency: 'INR', status: 'captured', captured: true };
    service = new PaymentsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    jest.spyOn(service as any, 'findUserBySupabaseId').mockResolvedValue({ id: 'customer' });
    jest.spyOn(service as any, 'findPaymentOrderByRazorpayOrderId').mockResolvedValue(order);
    fetchPayment = jest.fn().mockImplementation(async () => payment);
    (getRazorpayInstance as jest.Mock).mockReturnValue({ payments: { fetch: fetchPayment } });
    fulfill = jest.spyOn(service as any, 'handleCapturedPayment').mockImplementation(async () => {
      order.status = 'SUCCESS'; return { status: 'success', paymentOrderId: order.id };
    });
  });
  afterEach(() => { process.env = { ...saved }; jest.restoreAllMocks(); });

  it.each(['', 'not-hex', '0'.repeat(64), undefined])('rejects missing/invalid proof before provider or fulfillment', async signature => {
    await expect(service.verifyCheckout('subject', { ...proof(), signature } as any)).rejects.toThrow('signature');
    expect(fetchPayment).not.toHaveBeenCalled(); expect(fulfill).not.toHaveBeenCalled();
  });
  it('binds HMAC to server order and payment IDs', () => {
    expect(verifyCheckoutSignature('order_owned', 'pay_owned', sign())).toBe(true);
    expect(verifyCheckoutSignature('order_other', 'pay_owned', sign())).toBe(false);
    expect(verifyCheckoutSignature('order_owned', 'pay_other', sign())).toBe(false);
  });
  it('fails closed without the API secret', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('configuration');
    expect(fetchPayment).not.toHaveBeenCalled(); expect(fulfill).not.toHaveBeenCalled();
  });
  it('never leaks provider transport errors or fulfills on a provider failure', async () => {
    fetchPayment.mockRejectedValue(new Error('synthetic-private-credential-sentinel'));
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('provider is unavailable');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('rejects provider currency mismatch', async () => {
    payment.currency = 'USD';
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('currency');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('validates DTO shape including missing signature', async () => {
    expect(await validate(plainToInstance(VerifyCheckoutDto, proof()))).toHaveLength(0);
    expect((await validate(plainToInstance(VerifyCheckoutDto, { orderId: 'order_owned', paymentId: 'pay_owned' }))).length).toBeGreaterThan(0);
  });
  it('rejects foreign ownership before checking provider', async () => {
    order.userId = 'someone-else';
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('not found');
    expect(fetchPayment).not.toHaveBeenCalled(); expect(fulfill).not.toHaveBeenCalled();
  });
  it.each(['LIVE', 'UNKNOWN'])('rejects wrong or historical unknown mode %s', async mode => {
    order.metadata.providerMode = mode;
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('environment');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('requires captured provider evidence in addition to a valid signature', async () => {
    payment.status = 'authorized'; payment.captured = false;
    expect((await service.verifyCheckout('subject', proof())).status).toBe('pending');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('rejects provider ownership mismatch', async () => {
    payment.order_id = 'order_other';
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('match');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('rejects provider amount mismatch', async () => {
    payment.amount = 9999;
    await expect(service.verifyCheckout('subject', proof())).rejects.toThrow('amount');
    expect(fulfill).not.toHaveBeenCalled();
  });
  it('fulfills once, records method without raw proof, and never backfills on replay', async () => {
    expect((await service.verifyCheckout('subject', proof())).status).toBe('success');
    expect((await service.verifyCheckout('subject', proof())).status).toBe('duplicate');
    expect(fulfill).toHaveBeenCalledTimes(1); expect(fetchPayment).toHaveBeenCalledTimes(1);
    const audit = fulfill.mock.calls[0][0];
    expect(audit.verification).toEqual({ method: 'CHECKOUT_HMAC_AND_PROVIDER_CAPTURE', signatureVerified: true });
    expect(JSON.stringify(audit)).not.toContain(sign());
    await expect(service.verifyCheckout('subject', { ...proof(), signature: '0'.repeat(64) })).rejects.toThrow('signature');
    expect(fulfill).toHaveBeenCalledTimes(1);
  });
});
