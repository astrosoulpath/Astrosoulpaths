import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { PaymentsService } from '../payments/payments.service';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { RazorpayVerificationService } from '../payments/razorpay-verification.service';

describe('Kundli subscription synthetic audit', () => {
  let previousKey: string | undefined;
  beforeEach(() => { previousKey = process.env.RAZORPAY_KEY_ID; process.env.RAZORPAY_KEY_ID = 'rzp_test_synthetic'; });
  afterEach(() => { if(previousKey === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = previousKey; });
  it('verifies exact webhook bytes and rejects tampering using synthetic credentials', () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-audit-secret';
    try {
      const raw = Buffer.from('{"event":"payment.captured"}');
      const signature = createHmac('sha256', 'synthetic-audit-secret')
        .update(raw)
        .digest('hex');
      const verifier = new RazorpayVerificationService();
      expect(verifier.verifyWebhookSignature(raw, signature)).toBe(true);
      expect(
        verifier.verifyWebhookSignature(Buffer.from('{}'), signature),
      ).toBe(false);
      expect(verifier.verifyWebhookSignature(raw, 'invalid')).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });
  it.each([
    ['ACTIVE', -1000, 'EXPIRED'],
    ['ACTIVE', 60000, 'ACTIVE'],
    ['CANCELLED', -1000, 'CANCELLED'],
    ['PENDING', 60000, 'PENDING'],
  ])(
    'current %s with end offset %s reports %s without writes',
    async (status, offset, expected) => {
      const stored = {
        subscriptionStatus: status,
        endDate: new Date(Date.now() + Number(offset)),
        subscriptionPlan: { name: 'ASTROLOGER_KUNDLI_YEARLY' },
      };
      const db = {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'synthetic' }) },
        subscription: {
          findFirst: jest.fn().mockResolvedValue(stored),
          update: jest.fn(),
        },
      };
      const result = await new SubscriptionService(
        db as unknown as PrismaService,
      ).getCurrentSubscription('synthetic-sub');
      expect(result.data?.subscriptionStatus).toBe(expected);
      expect(stored.subscriptionStatus).toBe(status);
      expect(db.subscription.update).not.toHaveBeenCalled();
    },
  );

  it('verified synthetic INR3500 activates once with no wallet or astrologer posting', async () => {
    const order = {
      id: 'synthetic-order',
      userId: 'synthetic-user',
      type: 'SUBSCRIPTION',
      amount: new Prisma.Decimal(3500),
      currency: 'INR',
      status: 'PENDING',
      razorpayOrderId: 'order_synthetic3500',
      metadata: {
        providerMode: 'TEST',
        subscriptionId: 'synthetic-subscription',
        subscriptionPlanId: 'synthetic-plan',
        planName: 'ASTROLOGER_KUNDLI_YEARLY',
      },
    };
    let marked = false;
    const db = {
      paymentOrder: {
        findUnique: jest.fn(async () => ({
          ...order,
          status: marked ? 'SUCCESS' : 'PENDING',
        })),
        updateMany: jest.fn(async () => {
          if (marked) return { count: 0 };
          marked = true;
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn(async () => ({
          ...order,
          status: 'SUCCESS',
        })),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'synthetic-subscription',
          userId: order.userId,
          subscriptionPlanId: 'synthetic-plan',
          subscriptionPlan: {
            name: 'ASTROLOGER_KUNDLI_YEARLY',
            durationDays: 365,
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'synthetic-subscription' }),
      },
      user: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({id:'synthetic-user',isActive:true,isBlocked:false,role:{name:'ASTROLOGER'},astrologer:{isApproved:true,isVerified:true}}) },
      wallet: { update: jest.fn() },
      walletLedger: { create: jest.fn() },
      astrologerEarning: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation(async (work) => work(db));
    const marketplace = {
      findMarketplaceOrderForRazorpayWebhook: jest.fn().mockResolvedValue(null),
    };
    const notifications = { createForUser: jest.fn() };
    const push = { sendToUser: jest.fn() };
    const service = new PaymentsService(
      db as never,
      {} as never,
      {} as never,
      marketplace as never,
      notifications as never,
      push as never,
    );
    const event = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_synthetic3500',
            order_id: order.razorpayOrderId,
            amount: 350000,
            currency: 'INR',
            status: 'captured',
            livemode: false,
          },
        },
      },
    };
    expect((await service.processVerifiedWebhook(event)).status).toBe(
      'success',
    );
    expect((await service.processVerifiedWebhook(event)).status).toBe(
      'duplicate',
    );
    expect(db.subscription.update).toHaveBeenCalledTimes(1);
    expect(db.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: 'ACTIVE' }),
      }),
    );
    expect(db.wallet.update).not.toHaveBeenCalled();
    expect(db.walletLedger.create).not.toHaveBeenCalled();
    expect(db.astrologerEarning.create).not.toHaveBeenCalled();
    expect(notifications.createForUser).toHaveBeenCalledTimes(1);
    expect(notifications.createForUser).toHaveBeenCalledWith(expect.objectContaining({userId:'synthetic-user',type:'subscription',data:expect.objectContaining({roleContext:'ASTROLOGER'})}));
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(order.amount.toNumber()).toBe(3500);
  });
});
