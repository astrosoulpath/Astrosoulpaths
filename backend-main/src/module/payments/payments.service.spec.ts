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

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock; update: jest.Mock };
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
    metadata: null,
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
    const razorpayInstance = getRazorpayInstance();

    fetchPaymentsSpy = jest
      .spyOn(razorpayInstance.orders, 'fetchPayments')
      .mockResolvedValue({ items: [] } as never);

    prismaMock = {
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
    fetchPaymentsSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
    expect(walletUpdateInput.data.balance.toString()).toBe('350');

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

  it('marks a pending order failed when Razorpay has no captured payment', async () => {
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
