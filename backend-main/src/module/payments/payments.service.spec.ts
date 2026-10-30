import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus, PaymentType, Prisma, SubscriptionStatus } from '@prisma/client';

import { getRazorpayInstance } from '../../config/razorpay.config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KundliOrderService } from '../kundli/kundli-order.service';
import { LocalizedPricingService } from './pricing/localized-pricing.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
jest.mock('razorpay', () => class SyntheticRazorpay {
  orders = { create: jest.fn(), fetchPayments: jest.fn(), fetch: jest.fn() };
  payments = { fetch: jest.fn(), refund: jest.fn() };
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock; update: jest.Mock };
    userProfile: { findUnique: jest.Mock };
    userAuthIdentity: { findUnique: jest.Mock };
    wallet: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    paymentOrder: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    kundliOrder: {
      upsert: jest.Mock;
    };
    walletLedger: { create: jest.Mock };
    subscription: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let kundliOrderServiceMock: {
    assertKundliExists: jest.Mock;
    getKundliPaymentMetadata: jest.Mock;
    createProcessingOrder: jest.Mock;
    triggerPdfGeneration: jest.Mock;
    markGenerationFailed: jest.Mock;
  };
  let localizedPricingServiceMock: {
    quotePrice: jest.Mock;
    quoteUsdPrice: jest.Mock;
  };

  let fetchPaymentsSpy: jest.SpyInstance;

  let notificationsServiceMock: {
    createForUser: jest.Mock;
  };

  let notificationsPushServiceMock: {
    sendToUser: jest.Mock;
  };

  const buildCapturedEvent = () => ({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_123',
          order_id: 'order_123',
          amount: 10000,
          currency: 'INR',
          method: 'upi',
        },
      },
    },
  });

  const buildFailedEvent = () => ({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_failed_123',
          order_id: 'order_123',
          amount: 10000,
          currency: 'INR',
          method: 'upi',
        },
      },
    },
  });

  const buildPaymentOrder = () => ({
    id: 'payment_order_123',
    userId: 'user_123',
    walletId: 'wallet_123',
    razorpayOrderId: 'order_123',
    razorpayPaymentId: null,
    razorpaySignature: null,
    amount: new Prisma.Decimal('100.00'),
    currency: 'INR',
    paymentMethod: null,
    type: PaymentType.WALLET_RECHARGE,
    metadata: {providerMode: 'TEST'},
    status: PaymentStatus.PENDING,
    rawWebhook: null,
    createdAt: new Date('2026-05-12T00:00:00.000Z'),
    updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    wallet: {
      id: 'wallet_123',
      userId: 'user_123',
      balance: new Prisma.Decimal('250.00'),
      paidBalance: new Prisma.Decimal('250.00'),
      freeBalance: new Prisma.Decimal('0.00'),
      lockedBalance: new Prisma.Decimal('0.00'),
      currency: 'INR',
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    },
  });

  beforeEach(async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_synthetic';
    process.env.RAZORPAY_KEY_SECRET = 'synthetic-unit-secret-not-a-provider-credential';
    const razorpayInstance = getRazorpayInstance();

    fetchPaymentsSpy = jest
      .spyOn(razorpayInstance.orders, 'fetchPayments')
      .mockResolvedValue({ items: [] } as never);

    prismaMock = {
      userProfile: { findUnique: jest.fn().mockResolvedValue({ lang: 'en' }) },
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user_123',
        }),
      },
      wallet: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      kundliOrder: {
        upsert: jest.fn(),
      },
      walletLedger: {
        create: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    kundliOrderServiceMock = {
      assertKundliExists: jest.fn(),
      getKundliPaymentMetadata: jest.fn().mockReturnValue({
        kundliId: 'kundli_123',
        lang: 'en',
      }),
      createProcessingOrder: jest.fn(),
      triggerPdfGeneration: jest.fn(),
      markGenerationFailed: jest.fn(),
    };

    localizedPricingServiceMock = {
      quotePrice: jest.fn(),
      quoteUsdPrice: jest.fn(),
    };

    notificationsServiceMock = {
      createForUser: jest.fn(),
    };

    notificationsPushServiceMock = {
      sendToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: KundliOrderService,
          useValue: kundliOrderServiceMock,
        },
        {
          provide: LocalizedPricingService,
          useValue: localizedPricingServiceMock,
        },
        {
          provide: MarketplaceService,
          useValue: {
            findMarketplaceOrderForRazorpayWebhook: jest
              .fn()
              .mockResolvedValue(null),
            finalizeMarketplaceRazorpayWebhook: jest.fn(),
            isMarketplaceRefundRequiredFinalizationError: jest
              .fn()
              .mockReturnValue(false),
            recordMarketplaceCapturedPaymentException: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
        {
          provide: NotificationsPushService,
          useValue: notificationsPushServiceMock,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    fetchPaymentsSpy?.mockRestore();
  });

  it.each(['0', '-1', '1.001', '90071992547410', 'NaN'])('rejects unsafe minor-unit conversion %s', value => {
    expect(() => (service as any).convertMajorUnitsToSubunits(new Prisma.Decimal(value))).toThrow();
  });

  it('rejects non-INR checkout without explicit merchant approval', async () => {
    const previous = process.env.RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED;
    delete process.env.RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED;
    try {
      await expect((service as any).createTypedPaymentOrder({userId: 'synthetic', amount: new Prisma.Decimal(1), currency: 'USD', type: PaymentType.SUBSCRIPTION})).rejects.toThrow('International checkout is disabled');
      expect(prismaMock.paymentOrder.create).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED;
      else process.env.RAZORPAY_INTERNATIONAL_PAYMENTS_ENABLED = previous;
    }
  });

  it.each([{id:'order_synthetic',amount:1,currency:'INR'},{id:'order_synthetic',amount:10000,currency:'USD'},{id:'',amount:10000,currency:'INR'}])('rejects a mismatched provider order before local persistence: %j', async response => {
    const create=jest.spyOn(getRazorpayInstance().orders,'create').mockResolvedValue(response as never);
    try {
      await expect((service as any).createTypedPaymentOrder({userId:'synthetic',amount:new Prisma.Decimal(100),currency:'INR',type:PaymentType.WALLET_RECHARGE})).rejects.toThrow('Provider order does not match');
      expect(prismaMock.paymentOrder.create).not.toHaveBeenCalled();
    } finally {create.mockRestore();}
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    ['production', 'rzp_test_synthetic', false],
    ['production', 'rzp_test_synthetic', true],
    ['test', 'rzp_live_synthetic', false],
    ['test', 'rzp_live_synthetic', true],
  ])('blocks unsafe creation before provider/storage calls: %s preclaimed=%s', async (nodeEnv, keyId, preclaimed) => {
    const previous = { ...process.env };
    const create = jest.spyOn(getRazorpayInstance().orders, 'create');
    try {
      process.env.NODE_ENV = String(nodeEnv);
      process.env.RAZORPAY_KEY_ID = String(keyId);
      delete process.env.PAYMENT_CREATION_SCHEMA_READY;
      delete process.env.PAYMENT_CREATION_COMMANDS_ENABLED;
      await expect((service as any).createTypedPaymentOrder({
        userId: 'synthetic', amount: new Prisma.Decimal(100), currency: 'INR', type: PaymentType.WALLET_RECHARGE,
        ...(preclaimed ? { creation: { id: 'synthetic', state: 'READY', providerOrderId: 'order_ready', amountMinor: 10000n, currency: 'INR' } } : {}),
      })).rejects.toThrow('Durable payment creation is required');
      expect(create).not.toHaveBeenCalled();
      expect(prismaMock.paymentOrder.create).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    } finally {
      create.mockRestore();
      process.env = previous;
    }
  });

  it('credits wallet and creates ledger for a captured payment', async () => {
    const paymentOrder = buildPaymentOrder();
    const event = buildCapturedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      ...paymentOrder,
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: 'pay_123',
      paymentMethod: 'upi',
    });
    prismaMock.wallet.findUnique.mockResolvedValue(paymentOrder.wallet);
    prismaMock.wallet.update.mockResolvedValue({
      ...paymentOrder.wallet,
      balance: new Prisma.Decimal('350.00'),
    });
    prismaMock.walletLedger.create.mockResolvedValue({ id: 'ledger_123' });

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'success',
      paymentOrderId: paymentOrder.id,
    });
    expect(prismaMock.paymentOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.wallet.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.walletLedger.create).toHaveBeenCalledTimes(1);

    const walletUpdateInput = prismaMock.wallet.update.mock.calls[0][0];
    expect(walletUpdateInput.data.balance.increment.toString()).toBe('100');
    expect(walletUpdateInput.where.userId).toBe(paymentOrder.userId);
    expect(walletUpdateInput.where.currency).toBe('INR');

    const ledgerCreateInput = prismaMock.walletLedger.create.mock.calls[0][0];
    expect(ledgerCreateInput.data.balanceBefore.toString()).toBe('250');
    expect(ledgerCreateInput.data.balanceAfter.toString()).toBe('350');
    expect(ledgerCreateInput.data.type).toBe('RECHARGE');
  });

  it('ignores a duplicate captured payment claimed by a racing webhook', async () => {
    const paymentOrder = buildPaymentOrder();
    const event = buildCapturedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'duplicate',
      paymentOrderId: paymentOrder.id,
    });
    expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('derives ledger bounds from atomic UPDATE rather than stale wallet SELECT', async () => {
    const order = buildPaymentOrder();
    prismaMock.wallet.findUnique.mockResolvedValue(order.wallet);
    prismaMock.wallet.update.mockResolvedValue({...order.wallet, balance: new Prisma.Decimal(450)});
    const result = await (service as any).creditWallet(prismaMock, order.walletId, new Prisma.Decimal(100), new Prisma.Decimal(100), new Prisma.Decimal(0), 'INR', order.userId);
    expect(result.balanceBefore.toString()).toBe('350');
    expect(result.balanceAfter.toString()).toBe('450');
  });

  it('rejects a wallet belonging to another owner', async () => {
    const order = buildPaymentOrder();
    prismaMock.wallet.findUnique.mockResolvedValue({...order.wallet, userId: 'foreign'});
    await expect((service as any).creditWallet(prismaMock, order.walletId, new Prisma.Decimal(100), new Prisma.Decimal(100), new Prisma.Decimal(0), 'INR', order.userId)).rejects.toThrow('Wallet not found');
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
  });

  it.each([PaymentStatus.REFUNDED, PaymentStatus.EXPIRED])('never reactivates a terminal %s order', async status => {
    prismaMock.paymentOrder.findUnique.mockResolvedValue({...buildPaymentOrder(), status});
    await expect(service.processVerifiedWebhook(buildCapturedEvent())).rejects.toThrow('Terminal payment');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects conflicting canonical and legacy payment identity', async () => {
    prismaMock.user.findUnique.mockResolvedValue({id: 'foreign'});
    await expect(service.reconcileOrder('synthetic', 'order_123')).rejects.toThrow('Conflicting payment identity');
    expect(fetchPaymentsSpy).not.toHaveBeenCalled();
  });

  it('uses server report price and an owned saved record, not client amount', async () => {
    const previous = {...process.env};
    process.env.KUNDLI_LEGACY_REPORT_CHECKOUT_APPROVED = 'true';
    process.env.KUNDLI_LEGACY_REPORT_PRICE_INR = '123.45';
    prismaMock.user.findUnique.mockResolvedValue({id: 'user_123', isActive: true, isBlocked: false});
    const owned = jest.fn().mockResolvedValue({id: 'owned'});
    (prismaMock as any).kundliSavedRecord = {findFirst: owned};
    const create = jest.spyOn(service as any, 'createTypedPaymentOrder').mockResolvedValue({id: 'order_synthetic'});
    try {
      await service.createKundliReportOrder('synthetic', {amount: 1, kundliId: 'kundli_synthetic'});
      expect((create.mock.calls[0][0] as {amount:Prisma.Decimal}).amount.toFixed(2)).toBe('123.45');
      expect(owned.mock.calls[0][0].where.OR).toContainEqual({customerUserId: 'user_123'});
      owned.mockResolvedValue(null);
      await expect(service.createKundliReportOrder('synthetic', {amount: 1, kundliId: 'foreign'})).rejects.toThrow('Authorized Kundli report not found');
      expect(create).toHaveBeenCalledTimes(1);
    } finally {process.env = previous;create.mockRestore();}
  });

  it.each([
    ['ASTROLOGER_KUNDLI_YEARLY', '3500', 'INR', 365],
    ['DAILY_HOROSCOPE_MONTHLY', '1', 'USD', 30],
  ])('fulfills %s without wallet or astrologer allocation and preserves purchased duration', async (name, amount, currency, days) => {
    const earning = {create: jest.fn(), upsert: jest.fn()};
    (prismaMock as any).astrologerEarning = earning;
    const order = {...buildPaymentOrder(), amount: new Prisma.Decimal(amount), currency, type: PaymentType.SUBSCRIPTION, metadata: {
      subscriptionId: 'sub', planName: name,
      planSnapshot: {name, durationDays: days, amount, currency},
    }};
    prismaMock.paymentOrder.updateMany.mockResolvedValue({count: 1});
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue(order);
    prismaMock.subscription.findUnique.mockResolvedValue({id: 'sub', userId: order.userId, subscriptionPlanId: 'plan', subscriptionPlan: {name: 'ASTROLOGER_KUNDLI_YEARLY', durationDays: 7}});
    prismaMock.subscription.update.mockResolvedValue({id: 'sub'});
    prismaMock.user.update.mockResolvedValue({});
    await (service as any).processSubscriptionTransaction(prismaMock, order, buildCapturedEvent().payload.payment.entity, buildCapturedEvent());
    const dates = prismaMock.subscription.update.mock.calls[0][0].data;
    expect(dates.endDate.getTime() - dates.startDate.getTime()).toBe(Number(days) * 86400000);
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
    expect(earning.create).not.toHaveBeenCalled();
    expect(earning.upsert).not.toHaveBeenCalled();
  });

  it.each([{amount: 1}, {currency: 'USD'}, {currency: ''}])('rejects captured amount/currency mismatch before a transaction: %j', async patch => {
    prismaMock.paymentOrder.findUnique.mockResolvedValue(buildPaymentOrder());
    const event = buildCapturedEvent();
    Object.assign(event.payload.payment.entity, patch);
    await expect(service.processVerifiedWebhook(event)).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('marks payment failed without crediting the wallet', async () => {
    const paymentOrder = buildPaymentOrder();
    const event = buildFailedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'failed',
      paymentOrderId: paymentOrder.id,
    });
    expect(prismaMock.paymentOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('creates a kundli order and triggers generation for a paid kundli report', async () => {
    const paymentOrder = {
      ...buildPaymentOrder(),
      type: PaymentType.KUNDLI_REPORT,
      walletId: null,
      wallet: null,
      metadata: {
        providerMode: 'TEST',
        kundliId: 'kundli_123',
        lang: 'en',
      },
    };
    const event = buildCapturedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      ...paymentOrder,
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: 'pay_123',
      paymentMethod: 'upi',
    });
    kundliOrderServiceMock.createProcessingOrder.mockResolvedValue({
      id: 'kundli_order_123',
    });

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'success',
      paymentOrderId: paymentOrder.id,
    });
    expect(kundliOrderServiceMock.createProcessingOrder).toHaveBeenCalledTimes(
      1,
    );
    expect(kundliOrderServiceMock.triggerPdfGeneration).toHaveBeenCalledWith(
      'kundli_order_123',
      expect.objectContaining({ id: paymentOrder.id }),
    );
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('reconciles a pending captured payment using Razorpay as source of truth', async () => {
    const paymentOrder = buildPaymentOrder();

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_123',
      supabaseId: 'supabase_user_123',
      isActive: true,
      isBlocked: false,
    });
    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);
    fetchPaymentsSpy.mockResolvedValue({
      items: [
        {
          id: 'pay_123',
          order_id: 'order_123',
          amount: 10000,
          currency: 'INR',
          method: 'upi',
          status: 'captured',
        },
      ],
    } as never);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      ...paymentOrder,
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: 'pay_123',
      paymentMethod: 'upi',
    });
    prismaMock.wallet.findUnique.mockResolvedValue(paymentOrder.wallet);
    prismaMock.wallet.update.mockResolvedValue({
      ...paymentOrder.wallet,
      balance: new Prisma.Decimal('350.00'),
    });
    prismaMock.walletLedger.create.mockResolvedValue({ id: 'ledger_123' });

    const result = await service.reconcileOrder(
      'supabase_user_123',
      'order_123',
    );

    expect(result).toEqual({
      status: 'success',
      paymentOrderId: paymentOrder.id,
      reason: 'reconciled_from_gateway',
    });
    expect(fetchPaymentsSpy).toHaveBeenCalledWith('order_123');
    expect(prismaMock.wallet.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.walletLedger.create).toHaveBeenCalledTimes(1);
  });

  it.each([[], [{status: 'authorized'}], [{status: 'created'}], [{status: 'failed'}, {status: 'authorized'}]].map(items => ({items})))('keeps unsettled gateway attempts pending without financial writes: %j', async ({items}) => {
    const order = buildPaymentOrder();
    prismaMock.user.findUnique.mockResolvedValue({id: 'user_123', isActive: true, isBlocked: false});
    prismaMock.paymentOrder.findUnique.mockResolvedValue(order);
    fetchPaymentsSpy.mockResolvedValue({items});
    expect(await service.reconcileOrder('supabase_user_123', 'order_123')).toEqual({
      status: 'pending', paymentOrderId: order.id, reason: 'gateway_payment_pending',
    });
    expect(prismaMock.paymentOrder.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('marks a pending order failed when Razorpay confirms all attempts failed', async () => {
    const paymentOrder = buildPaymentOrder();

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_123',
      supabaseId: 'supabase_user_123',
      isActive: true,
      isBlocked: false,
    });
    prismaMock.paymentOrder.findUnique
      .mockResolvedValueOnce(paymentOrder)
      .mockResolvedValueOnce({
        ...paymentOrder,
        status: PaymentStatus.FAILED,
      });
    fetchPaymentsSpy.mockResolvedValue({
      items: [
        {
          id: 'pay_failed_123',
          order_id: 'order_123',
          amount: 10000,
          currency: 'INR',
          method: 'upi',
          status: 'failed',
        },
      ],
    } as never);
    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.reconcileOrder(
      'supabase_user_123',
      'order_123',
    );

    expect(result).toEqual({
      status: 'failed',
      paymentOrderId: paymentOrder.id,
      reason: 'gateway_payment_failed',
    });
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('returns duplicate for a payment order that is already settled before reconciliation', async () => {
    const paymentOrder = {
      ...buildPaymentOrder(),
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: 'pay_123',
    };

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_123',
      supabaseId: 'supabase_user_123',
      isActive: true,
      isBlocked: false,
    });
    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);

    const result = await service.reconcileOrder(
      'supabase_user_123',
      'order_123',
    );

    expect(result).toEqual({
      status: 'duplicate',
      paymentOrderId: paymentOrder.id,
      reason: 'already_processed',
    });
    expect(fetchPaymentsSpy).not.toHaveBeenCalled();
    expect(prismaMock.wallet.update).not.toHaveBeenCalled();
    expect(prismaMock.walletLedger.create).not.toHaveBeenCalled();
  });

  it('activates subscription and sends personalized horoscope notification', async () => {
    const paymentOrder = {
      ...buildPaymentOrder(),
      type: PaymentType.SUBSCRIPTION,
      walletId: null,
      wallet: null,
      metadata: {
        providerMode: 'TEST',
        subscriptionId: 'subscription_123',
        subscriptionPlanId: 'plan_123',
        planName: 'DAILY_HOROSCOPE_MONTHLY',
      },
    };

    const event = buildCapturedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );

    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 1 });

    prismaMock.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      ...paymentOrder,
      status: PaymentStatus.SUCCESS,
      razorpayPaymentId: 'pay_123',
      paymentMethod: 'upi',
    });

    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'subscription_123',
      userId: 'user_123',
      subscriptionPlanId: 'plan_123',
      subscriptionStatus: SubscriptionStatus.PENDING,
      subscriptionPlan: {
        id: 'plan_123',
        name: 'DAILY_HOROSCOPE_MONTHLY',
        durationDays: 30,
      },
    });

    prismaMock.subscription.update.mockResolvedValue({
      id: 'subscription_123',
      userId: 'user_123',
      subscriptionPlanId: 'plan_123',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    });

    prismaMock.user.update.mockResolvedValue({
      id: 'user_123',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionPlanId: 'plan_123',
    });

    notificationsServiceMock.createForUser.mockResolvedValue({
      id: 'notification_123',
      userId: 'user_123',
      title: 'Personalized Daily Horoscope activated',
      body:
        'Your subscription is active. Your personalized Vedic horoscope is now available.',
    });

    notificationsPushServiceMock.sendToUser.mockResolvedValue(undefined);

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'success',
      paymentOrderId: paymentOrder.id,
    });

    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'subscription_123',
        },
        data: expect.objectContaining({
          subscriptionStatus: SubscriptionStatus.ACTIVE,
        }),
      }),
    );

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'user_123',
        },
        data: expect.objectContaining({
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionPlanId: 'plan_123',
        }),
      }),
    );

    expect(notificationsServiceMock.createForUser).toHaveBeenCalledTimes(1);

    expect(notificationsServiceMock.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_123',
        title: 'Personalized Daily Horoscope activated',
        type: 'subscription',
        data: expect.objectContaining({
          type: 'subscription',
          screen: 'horoscope',
          subscriptionId: 'subscription_123',
          status: 'ACTIVE',
          source: 'subscription-activation',
        }),
      }),
    );

    expect(notificationsPushServiceMock.sendToUser).toHaveBeenCalledTimes(1);

    expect(notificationsPushServiceMock.sendToUser).toHaveBeenCalledWith(
      'user_123',
      expect.objectContaining({
        title: 'Personalized Daily Horoscope activated',
        data: expect.objectContaining({
          type: 'subscription',
          screen: 'horoscope',
          subscriptionId: 'subscription_123',
          notificationId: 'notification_123',
          status: 'ACTIVE',
          source: 'subscription-activation',
        }),
      }),
    );
  });

  it('does not send personalized horoscope notification for duplicate subscription webhook', async () => {
    const paymentOrder = {
      ...buildPaymentOrder(),
      type: PaymentType.SUBSCRIPTION,
      walletId: null,
      wallet: null,
      metadata: {
        providerMode: 'TEST',
        subscriptionId: 'subscription_123',
        subscriptionPlanId: 'plan_123',
        planName: 'DAILY_HOROSCOPE_MONTHLY',
      },
    };

    const event = buildCapturedEvent();

    prismaMock.paymentOrder.findUnique.mockResolvedValue(paymentOrder);

    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback(prismaMock),
    );

    prismaMock.paymentOrder.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.processVerifiedWebhook(event);

    expect(result).toEqual({
      status: 'duplicate',
      paymentOrderId: paymentOrder.id,
    });

    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();

    expect(
      notificationsServiceMock.createForUser,
    ).not.toHaveBeenCalled();

    expect(
      notificationsPushServiceMock.sendToUser,
    ).not.toHaveBeenCalled();
  });
});
