import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  LedgerReferenceType,
  LedgerType,
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';

jest.mock('../src/common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class MockSupabaseAuthGuard {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      request.user = { sub: 'supabase_user_123' };
      return true;
    }
  },
}));

import { razorpayInstance } from '../src/config/razorpay.config';
import { SupabaseAuthGuard } from '../src/common/guards/supabase-auth.guard';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { KundliOrderService } from '../src/module/kundli/kundli-order.service';
import { PaymentsController } from '../src/module/payments/payments.controller';
import { PaymentsService } from '../src/module/payments/payments.service';
import { RazorpayVerificationService } from '../src/module/payments/razorpay-verification.service';

type TestUser = {
  id: string;
  supabaseId: string;
};

type TestWallet = {
  id: string;
  userId: string;
  balance: Prisma.Decimal;
  lockedBalance: Prisma.Decimal;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestPaymentOrder = {
  id: string;
  userId: string;
  walletId: string | null;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  amount: Prisma.Decimal;
  currency: string;
  paymentMethod: string | null;
  type: PaymentType;
  metadata: Prisma.JsonValue | null;
  status: PaymentStatus;
  rawWebhook: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestWalletLedger = {
  id: string;
  walletId: string;
  userId: string;
  type: LedgerType;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  referenceType: LedgerReferenceType | null;
  referenceId: string | null;
  description: string | null;
};

type TestState = {
  users: TestUser[];
  wallets: TestWallet[];
  paymentOrders: TestPaymentOrder[];
  walletLedgers: TestWalletLedger[];
};

describe('Payments reconciliation (e2e)', () => {
  let app: INestApplication<App>;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let fetchPaymentsSpy: jest.SpyInstance;

  beforeEach(async () => {
    prismaMock = createPrismaMock(createInitialState());
    fetchPaymentsSpy = jest
      .spyOn(razorpayInstance.orders, 'fetchPayments')
      .mockResolvedValue({ items: [] } as never);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: KundliOrderService,
          useValue: {
            assertKundliExists: jest.fn(),
            getKundliPaymentMetadata: jest.fn(),
            createProcessingOrder: jest.fn(),
            triggerPdfGeneration: jest.fn(),
            markGenerationFailed: jest.fn(),
          },
        },
        {
          provide: RazorpayVerificationService,
          useValue: {
            extractWebhookRawBody: jest.fn(),
            verifyWebhookSignature: jest.fn(),
            parseWebhookPayload: jest.fn(),
          },
        },
        {
          provide: SupabaseAuthGuard,
          useValue: new SupabaseAuthGuard(),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    fetchPaymentsSpy.mockRestore();
    await app.close();
  });

  it('reconciles a captured pending wallet payment and credits exactly once', async () => {
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

    const response = await request(app.getHttpServer())
      .post('/payments/reconcile/order_123')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      status: 'SUCCESS',
      reason: 'reconciled_from_gateway',
    });

    const state = prismaMock.__getState();
    const paymentOrder = state.paymentOrders[0];
    const wallet = state.wallets[0];
    const ledgerEntries = state.walletLedgers;

    expect(paymentOrder.status).toBe(PaymentStatus.SUCCESS);
    expect(paymentOrder.razorpayPaymentId).toBe('pay_123');
    expect(wallet.balance.toString()).toBe('350');
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].balanceBefore.toString()).toBe('250');
    expect(ledgerEntries[0].balanceAfter.toString()).toBe('350');
  });

  it('returns already processed on duplicate reconciliation without double credit', async () => {
    const initialState = prismaMock.__getState();
    initialState.paymentOrders[0].status = PaymentStatus.SUCCESS;
    initialState.paymentOrders[0].razorpayPaymentId = 'pay_existing';
    initialState.walletLedgers.push(
      buildLedger({
        referenceId: initialState.paymentOrders[0].id,
        balanceBefore: '250.00',
        balanceAfter: '350.00',
      }),
    );
    initialState.wallets[0].balance = new Prisma.Decimal('350.00');

    const response = await request(app.getHttpServer())
      .post('/payments/reconcile/order_123')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      status: 'SUCCESS',
      reason: 'already_processed',
    });

    const state = prismaMock.__getState();
    expect(state.wallets[0].balance.toString()).toBe('350');
    expect(state.walletLedgers).toHaveLength(1);
    expect(fetchPaymentsSpy).not.toHaveBeenCalled();
  });

  it('marks the order failed when Razorpay shows no captured payment', async () => {
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

    const response = await request(app.getHttpServer())
      .post('/payments/reconcile/order_123')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      status: 'FAILED',
      reason: 'gateway_payment_failed',
    });

    const state = prismaMock.__getState();
    expect(state.paymentOrders[0].status).toBe(PaymentStatus.FAILED);
    expect(state.wallets[0].balance.toString()).toBe('250');
    expect(state.walletLedgers).toHaveLength(0);
  });

  it('rolls back the transaction and reports amount mismatch', async () => {
    fetchPaymentsSpy.mockResolvedValue({
      items: [
        {
          id: 'pay_mismatch_123',
          order_id: 'order_123',
          amount: 9999,
          currency: 'INR',
          method: 'upi',
          status: 'captured',
        },
      ],
    } as never);

    const response = await request(app.getHttpServer())
      .post('/payments/reconcile/order_123')
      .set('Authorization', 'Bearer test-token')
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      status: 'FAILED',
      reason: 'amount_mismatch',
    });

    const state = prismaMock.__getState();
    expect(state.paymentOrders[0].status).toBe(PaymentStatus.PENDING);
    expect(state.paymentOrders[0].razorpayPaymentId).toBeNull();
    expect(state.wallets[0].balance.toString()).toBe('250');
    expect(state.walletLedgers).toHaveLength(0);
  });
});

function createInitialState(): TestState {
  return {
    users: [
      {
        id: 'user_123',
        supabaseId: 'supabase_user_123',
      },
    ],
    wallets: [
      {
        id: 'wallet_123',
        userId: 'user_123',
        balance: new Prisma.Decimal('250.00'),
        lockedBalance: new Prisma.Decimal('0.00'),
        currency: 'INR',
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
        updatedAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    ],
    paymentOrders: [
      {
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
      },
    ],
    walletLedgers: [],
  };
}

function createPrismaMock(initialState: TestState) {
  const state = initialState;

  const createClient = (workingState: TestState) => ({
    user: {
      findUnique: jest.fn(({ where }: { where: { supabaseId?: string } }) => {
        const user = workingState.users.find(
          (entry) => entry.supabaseId === where.supabaseId,
        );

        return Promise.resolve(user ? { ...user } : null);
      }),
    },
    wallet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const wallet = workingState.wallets.find(
          (entry) => entry.id === where.id,
        );
        return Promise.resolve(wallet ? cloneWallet(wallet) : null);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { balance: Prisma.Decimal };
        }) => {
          const wallet = workingState.wallets.find(
            (entry) => entry.id === where.id,
          );

          if (!wallet) {
            throw new Error('Wallet not found');
          }

          wallet.balance = new Prisma.Decimal(data.balance);
          wallet.updatedAt = new Date();

          return Promise.resolve(cloneWallet(wallet));
        },
      ),
      upsert: jest.fn(),
    },
    paymentOrder: {
      findUnique: jest.fn(
        ({
          where,
          include,
        }: {
          where: { id?: string; razorpayOrderId?: string };
          include?: { wallet?: boolean; kundliOrder?: boolean };
        }) => {
          const paymentOrder = workingState.paymentOrders.find(
            (entry) =>
              (where.id && entry.id === where.id) ||
              (where.razorpayOrderId &&
                entry.razorpayOrderId === where.razorpayOrderId),
          );

          return Promise.resolve(
            paymentOrder
              ? clonePaymentOrderWithRelations(
                  paymentOrder,
                  workingState,
                  include,
                )
              : null,
          );
        },
      ),
      findUniqueOrThrow: jest.fn(({ where }: { where: { id: string } }) => {
        const paymentOrder = workingState.paymentOrders.find(
          (entry) => entry.id === where.id,
        );

        if (!paymentOrder) {
          throw new Error('Payment order not found');
        }

        return Promise.resolve(clonePaymentOrder(paymentOrder));
      }),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: {
            id: string;
            status?: PaymentStatus;
            status?: { not: PaymentStatus } | PaymentStatus;
          };
          data: Partial<TestPaymentOrder>;
        }) => {
          const paymentOrder = workingState.paymentOrders.find(
            (entry) => entry.id === where.id,
          );

          if (!paymentOrder) {
            return Promise.resolve({ count: 0 });
          }

          const statusFilter = where.status;
          const matchesStatus =
            !statusFilter ||
            (typeof statusFilter === 'object' && 'not' in statusFilter
              ? paymentOrder.status !== statusFilter.not
              : paymentOrder.status === statusFilter);

          if (!matchesStatus) {
            return Promise.resolve({ count: 0 });
          }

          Object.assign(paymentOrder, data, { updatedAt: new Date() });
          return Promise.resolve({ count: 1 });
        },
      ),
      create: jest.fn(),
    },
    walletLedger: {
      create: jest.fn(({ data }: { data: Omit<TestWalletLedger, 'id'> }) => {
        const ledger = buildLedger({
          ...data,
          amount: data.amount.toString(),
          balanceBefore: data.balanceBefore.toString(),
          balanceAfter: data.balanceAfter.toString(),
        });

        workingState.walletLedgers.push(ledger);
        return Promise.resolve(cloneLedger(ledger));
      }),
    },
  });

  const prismaMock = createClient(state) as ReturnType<typeof createClient> & {
    $transaction: jest.Mock;
    __getState: () => TestState;
  };

  prismaMock.$transaction = jest.fn(
    async (
      callback: (tx: ReturnType<typeof createClient>) => Promise<unknown>,
    ) => {
      const workingState = cloneState(state);
      const transactionClient = createClient(workingState);

      try {
        const result = await callback(transactionClient);
        replaceState(state, workingState);
        return result;
      } catch (error) {
        throw error;
      }
    },
  );

  prismaMock.__getState = () => state;

  return prismaMock;
}

function cloneState(state: TestState): TestState {
  return {
    users: state.users.map((user) => ({ ...user })),
    wallets: state.wallets.map(cloneWallet),
    paymentOrders: state.paymentOrders.map(clonePaymentOrder),
    walletLedgers: state.walletLedgers.map(cloneLedger),
  };
}

function replaceState(target: TestState, source: TestState): void {
  target.users.splice(
    0,
    target.users.length,
    ...source.users.map((user) => ({ ...user })),
  );
  target.wallets.splice(
    0,
    target.wallets.length,
    ...source.wallets.map(cloneWallet),
  );
  target.paymentOrders.splice(
    0,
    target.paymentOrders.length,
    ...source.paymentOrders.map(clonePaymentOrder),
  );
  target.walletLedgers.splice(
    0,
    target.walletLedgers.length,
    ...source.walletLedgers.map(cloneLedger),
  );
}

function cloneWallet(wallet: TestWallet): TestWallet {
  return {
    ...wallet,
    balance: new Prisma.Decimal(wallet.balance),
    lockedBalance: new Prisma.Decimal(wallet.lockedBalance),
    createdAt: new Date(wallet.createdAt),
    updatedAt: new Date(wallet.updatedAt),
  };
}

function clonePaymentOrder(paymentOrder: TestPaymentOrder): TestPaymentOrder {
  return {
    ...paymentOrder,
    amount: new Prisma.Decimal(paymentOrder.amount),
    createdAt: new Date(paymentOrder.createdAt),
    updatedAt: new Date(paymentOrder.updatedAt),
  };
}

function cloneLedger(ledger: TestWalletLedger): TestWalletLedger {
  return {
    ...ledger,
    amount: new Prisma.Decimal(ledger.amount),
    balanceBefore: new Prisma.Decimal(ledger.balanceBefore),
    balanceAfter: new Prisma.Decimal(ledger.balanceAfter),
  };
}

function clonePaymentOrderWithRelations(
  paymentOrder: TestPaymentOrder,
  state: TestState,
  include?: { wallet?: boolean; kundliOrder?: boolean },
) {
  const clonedPaymentOrder = clonePaymentOrder(
    paymentOrder,
  ) as TestPaymentOrder & {
    wallet?: TestWallet | null;
    kundliOrder?: null;
  };

  if (include?.wallet) {
    const wallet = state.wallets.find(
      (entry) => entry.id === paymentOrder.walletId,
    );
    clonedPaymentOrder.wallet = wallet ? cloneWallet(wallet) : null;
  }

  if (include?.kundliOrder) {
    clonedPaymentOrder.kundliOrder = null;
  }

  return clonedPaymentOrder;
}

function buildLedger(input: {
  walletId?: string;
  userId?: string;
  type?: LedgerType;
  amount?: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceType?: LedgerReferenceType | null;
  referenceId: string;
  description?: string | null;
}): TestWalletLedger {
  return {
    id: `ledger_${Math.random().toString(36).slice(2, 10)}`,
    walletId: input.walletId ?? 'wallet_123',
    userId: input.userId ?? 'user_123',
    type: input.type ?? LedgerType.RECHARGE,
    amount: new Prisma.Decimal(input.amount ?? '100.00'),
    balanceBefore: new Prisma.Decimal(input.balanceBefore),
    balanceAfter: new Prisma.Decimal(input.balanceAfter),
    referenceType: input.referenceType ?? LedgerReferenceType.WALLET_RECHARGE,
    referenceId: input.referenceId,
    description: input.description ?? 'Wallet recharge via reconciliation',
  };
}
