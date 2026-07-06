import { Test, TestingModule } from '@nestjs/testing';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';

import { razorpayInstance } from '../../config/razorpay.config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KundliOrderService } from '../kundli/kundli-order.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock };
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
  };
  let kundliOrderServiceMock: {
    assertKundliExists: jest.Mock;
    getKundliPaymentMetadata: jest.Mock;
    createProcessingOrder: jest.Mock;
    triggerPdfGeneration: jest.Mock;
    markGenerationFailed: jest.Mock;
  };
  let fetchPaymentsSpy: jest.SpyInstance;

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
      lockedBalance: new Prisma.Decimal('0.00'),
      currency: 'INR',
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    },
  });

  beforeEach(async () => {
    fetchPaymentsSpy = jest
      .spyOn(razorpayInstance.orders, 'fetchPayments')
      .mockResolvedValue({ items: [] } as never);

    prismaMock = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
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
});
