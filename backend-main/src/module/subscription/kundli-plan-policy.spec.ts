import { Prisma } from '@prisma/client';
import { assertKundliCheckoutAvailable, assertKundliPlan, KUNDLI_YEARLY_PLAN } from './kundli-plan-policy';
jest.mock('../../config/razorpay.config', () => {
  const client = {
    orders: { create: jest.fn().mockImplementation(async (input: {amount:number;currency:string}) => ({ id: 'synthetic-order', amount:input.amount, currency:input.currency })) },
  };
  return { getRazorpayInstance: () => client };
});
import { getRazorpayInstance } from '../../config/razorpay.config';
import { PaymentsService } from '../payments/payments.service';

describe('professional Kundli fixed yearly checkout policy', () => {
  const originalGate = process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
  afterEach(() => {
    if (originalGate === undefined) delete process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
    else process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED = originalGate;
  });
  it.each([undefined, 'false', 'TRUE', '1'])('checkout fails closed for gate %s', async (gate) => {
    if (gate === undefined) delete process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
    else process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED = gate;
    const service = new PaymentsService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.createSubscriptionOrder('synthetic', {planName: KUNDLI_YEARLY_PLAN})).rejects.toThrow('not yet activated');
  });
  it('does not gate unrelated subscription products', () => {
    delete process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED;
    expect(() => assertKundliCheckoutAvailable('DAILY_HOROSCOPE_MONTHLY')).not.toThrow();
  });
  const plan = {
    name: KUNDLI_YEARLY_PLAN,
    price: new Prisma.Decimal(3500),
    currency: 'INR',
    durationDays: 365,
  };
  it('accepts confirmed INR3500 / 365 days', () => {
    expect(() => assertKundliPlan(plan)).not.toThrow();
  });
  it.each([{ price: 3000 }, { currency: 'USD' }, { durationDays: 30 }])(
    'rejects stale or localized checkout configuration %j',
    (change) => {
      expect(() => assertKundliPlan({ ...plan, ...change })).toThrow(
        'INR 3500',
      );
    },
  );
  it('does not repurpose a separate customer product', () => {
    expect(() =>
      assertKundliPlan({
        ...plan,
        name: 'SEPARATE_CUSTOMER_PRODUCT',
        price: 1,
      }),
    ).not.toThrow();
  });
  it.each([true, false])(
    'professional eligibility is preserved, isAstrologer=%s',
    async (isAstrologer) => {
      process.env.KUNDLI_SUBSCRIPTION_CHECKOUT_ENABLED = 'true';
      jest.clearAllMocks();
      const db = {
        userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              id: 'synthetic-user',
              isActive: true,
              isBlocked: false,
              isAstrologer,
            }),
        },
        astrologer: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ isApproved: true, isVerified: true }),
        },
        subscriptionPlan: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              ...plan,
              id: 'synthetic-plan',
              isActive: true,
            }),
        },
        userProfile: {
          findUnique: jest.fn().mockResolvedValue({ countryCode: 'US' }),
        },
        subscription: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'synthetic-subscription' }),
          update: jest.fn(),
        },
        paymentOrder: { create: jest.fn() },
      };
      const pricing = { quotePrice: jest.fn() };
      const service = new PaymentsService(
        db as never,
        {} as never,
        pricing as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const result = service.createSubscriptionOrder('synthetic-subject', {
        planName: KUNDLI_YEARLY_PLAN,
      });
      if (!isAstrologer) {
        await expect(result).rejects.toThrow('only for astrologers');
        expect(getRazorpayInstance().orders.create).not.toHaveBeenCalled();
        expect(db.subscription.create).not.toHaveBeenCalled();
        return;
      }
      await expect(result).resolves.toMatchObject({ id: 'synthetic-order' });
      expect(pricing.quotePrice).not.toHaveBeenCalled();
      expect(getRazorpayInstance().orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 350000, currency: 'INR' }),
      );
      expect(db.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionStatus: 'PENDING',
            currency: 'INR',
          }),
        }),
      );
    },
  );
});
