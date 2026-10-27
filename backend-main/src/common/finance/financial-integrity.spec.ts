jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({
  SupabaseJwtService: jest.fn(),
}));
import { Prisma } from '@prisma/client';
import {
  validateCommissionPercent,
  DEFAULT_PLATFORM_COMMISSION_PERCENT,
} from './commission-policy';
import { AdminRepository } from '../../module/admin/admin.repository';
import { AdminService } from '../../module/admin/admin.service';
import { ConsultationRepository } from '../../module/consultation/consultation.repository';
import { AstrologerPayoutWebhookService } from '../../module/astrologer/astrologer-payout-webhook.service';
import { PaymentsService } from '../../module/payments/payments.service';
import { AstrologerService } from '../../module/astrologer/astrologer.service';
import { EarningReleaseProcessor } from '../../module/consultation/earning-release.processor';

describe('new bank verification safety', () => {
  it('fund-account creation does not verify ownership or rewrite historical accounts as verified', async () => {
    const tx: any = {
      astrologerBankAccount: {
        updateMany: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(async ({ data }) => ({ id: 'bank', ...data })),
      },
    };
    const db: any = {
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'owner' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'owner',
          isActive: true,
          isBlocked: false,
          isAstrologer: true,
          astrologer: { id: 'astro', isApproved: true, isVerified: true },
        }),
      },
      $transaction: jest.fn(async (fn) => fn(tx)),
    };
    const service: any = Object.create(AstrologerService.prototype);
    service.prisma = db;
    service.payoutProvider = {
      createBankFundAccount: jest
        .fn()
        .mockResolvedValue({ contactId: 'contact', fundAccountId: 'fund' }),
    };
    const result = await service.savePayoutBankAccount('subject', {
      accountNumber: '1234567890',
      ifsc: 'TEST0000001',
      accountHolderName: 'Synthetic Test',
    });
    expect(result.data.isVerified).toBe(false);
    expect(
      tx.astrologerBankAccount.create.mock.calls[0][0].data.isVerified,
    ).toBe(false);
    expect(tx.astrologerBankAccount.updateMany.mock.calls[0][0].data).toEqual({
      isActive: false,
    });
  });
});

describe('commission settings safety (mock persistence)', () => {
  const originalSchemaFlag = process.env.FINANCIAL_SCHEMA_READY;
  afterEach(() => {
    if (originalSchemaFlag === undefined) delete process.env.FINANCIAL_SCHEMA_READY;
    else process.env.FINANCIAL_SCHEMA_READY = originalSchemaFlag;
  });
  it('labels payment collections explicitly without repurposing the historical response key', async () => {
    const groupBy = jest.fn().mockResolvedValue([{currency: 'INR',
      _count: { id: 2 },
      _sum: { amount: new Prisma.Decimal(100) },
      _avg: { amount: 50 },
    }]);
    const result = await new AdminRepository({
      paymentOrder: { groupBy },
    } as any).getRevenueSummary();
    expect(result.accountingBasis).toBe('SUCCESSFUL_PAYMENT_COLLECTIONS');
    expect(result.successfulPaymentCollections).toEqual(result.totalRevenue);
    expect(groupBy.mock.calls[0][0].where.status).toBe('SUCCESS');
  });
  it.each([false, true])(
    'settings writes share a transaction (config failure=%s)',
    async (fails) => {
      process.env.FINANCIAL_SCHEMA_READY = 'true';
      const repo: any = {
        getPlatformSettings: jest.fn().mockResolvedValue({
          platformCommissionPercent: new Prisma.Decimal(30),
        }),
      };
      const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(1),
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'synthetic-admin', isActive: true, isBlocked: false }) },
        platformSettings: {
          findUnique: jest.fn().mockResolvedValue({ platformCommissionPercent: new Prisma.Decimal(30) }),
          upsert: jest.fn().mockResolvedValue({
            platformCommissionPercent: new Prisma.Decimal(25),
          }),
        },
        appConfig: {
          update: jest.fn().mockImplementation(async () => {
            if (fails) throw new Error('synthetic config failure');
            return {};
          }),
        },
      };
      const db: any = {
        appConfig: { findUnique: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn(async (fn) => fn(tx)),
      };
      const service: any = Object.create(AdminService.prototype);
      service.adminRepository = repo;
      service.prisma = db;
      const operation = service.updatePlatformSettings({
        platformCommissionPercent: 25,
      }, 'synthetic-admin-subject');
      if (fails)
        await expect(operation).rejects.toThrow('synthetic config failure');
      else expect((await operation).data.platformCommissionPercent).toBe(25);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.platformSettings.upsert).toHaveBeenCalledTimes(1);
      expect(tx.appConfig.update).toHaveBeenCalledTimes(1);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(repo.updatePlatformSettings).toBeUndefined();
    },
  );
  it('rejects commission changes before any settings write when audit storage is disabled', async () => {
    delete process.env.FINANCIAL_SCHEMA_READY;
    const tx: any = { platformSettings: { upsert: jest.fn() }, appConfig: { update: jest.fn() } };
    const service: any = Object.create(AdminService.prototype);
    service.adminRepository = { getPlatformSettings: jest.fn().mockResolvedValue({ platformCommissionPercent: new Prisma.Decimal(30) }) };
    service.prisma = { appConfig: { findUnique: jest.fn().mockResolvedValue({}) }, $transaction: jest.fn(async fn => fn(tx)) };
    await expect(service.updatePlatformSettings({ platformCommissionPercent: 25 }, 'synthetic-admin-subject')).rejects.toThrow('Commission audit schema');
    expect(tx.platformSettings.upsert).not.toHaveBeenCalled();
    expect(tx.appConfig.update).not.toHaveBeenCalled();
  });
  it.each([-1, 101, NaN, Infinity, 30.001, '30', null])(
    'rejects invalid percentage %s',
    (value) => {
      expect(() => validateCommissionPercent(value)).toThrow();
    },
  );
  it.each([0, 30, 100, 12.34])('accepts supported precision %s', (value) => {
    expect(() => validateCommissionPercent(value)).not.toThrow();
  });
  it('GET returns the existing default without any write', async () => {
    const db: any = {
      platformSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    const settings = await new AdminRepository(db).getPlatformSettings();
    expect(Number(settings.platformCommissionPercent)).toBe(
      DEFAULT_PLATFORM_COMMISSION_PERCENT,
    );
    expect(settings.updatedAt).toBeNull();
    expect(db.platformSettings.upsert).not.toHaveBeenCalled();
  });
  it('preserves configured commission rather than enforcing the default', async () => {
    const existing = {
      platformCommissionPercent: new Prisma.Decimal(12.34),
      updatedAt: new Date(),
    };
    const db: any = {
      platformSettings: { findUnique: jest.fn().mockResolvedValue(existing) },
    };
    expect(await new AdminRepository(db).getPlatformSettings()).toBe(existing);
  });
  it('rejects invalid unrelated settings before a commission write', async () => {
    const repository: any = {
      getPlatformSettings: jest
        .fn()
        .mockResolvedValue({ platformCommissionPercent: 30 }),
      updatePlatformSettings: jest.fn(),
    };
    const service = new AdminService(
      repository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    await expect(
      service.updatePlatformSettings({
        platformCommissionPercent: 40,
        websiteUrl: 'http://invalid.example',
      }),
    ).rejects.toThrow();
    expect(repository.updatePlatformSettings).not.toHaveBeenCalled();
    await expect(
      service.updatePlatformSettings({ platformCommissionPercent: 30.001 }),
    ).rejects.toThrow();
  });
});

describe('consultation completion integrity (in-memory only)', () => {
  let db: any,
    tx: any,
    call: any,
    entries: any[],
    repository: ConsultationRepository;
  beforeEach(() => {
    call = {
      id: 'call',
      userId: 'customer',
      astrologerId: 'astro',
      status: 'ACTIVE',
      endedAt: null,
      amountCharged: 1.05,
      isFreeChat: false,
    };
    entries = [
      {
        type: 'CALL_DEDUCTION',
        amount: new Prisma.Decimal(1.05),
        balanceBefore: 10,
        balanceAfter: 8.95,
      },
    ];
    tx = {
      callSession: {
        findUnique: jest.fn(async () => call),
        findUniqueOrThrow: jest.fn(async () => call),
        update: jest.fn(async ({ data }) => Object.assign(call, data)),
      },
      astrologer: { findUnique: jest.fn(async () => ({ id: 'profile' })) },
      astrologerEarning: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(),
      },
      walletLedger: { findMany: jest.fn(async () => entries) },
    };
    db = { $transaction: jest.fn(async (run) => run(tx)) };
    repository = new ConsultationRepository(db);
  });
  async function complete(amount = 1.05, percent = 30) {
    return repository.completeConsultation('call', {
      amountCharged: amount,
      platformFeePercent: percent,
    });
  }
  it.each(['chat', 'audio', 'video'])(
    'default 70/30 %s split conserves fractional money',
    async (mode) => {
      call.mode = mode;
      await complete();
      const data = tx.astrologerEarning.upsert.mock.calls[0][0].create;
      expect(data.platformFee.toFixed(2)).toBe('0.32');
      expect(data.netAmount.toFixed(2)).toBe('0.73');
      expect(data.netAmount.plus(data.platformFee).eq(data.grossAmount)).toBe(
        true,
      );
    },
  );
  it.each(['PENDING', 'REJECTED', 'CANCELLED', 'EXPIRED'])(
    'cannot settle %s',
    async (status) => {
      call.status = status;
      await expect(complete()).rejects.toThrow();
      expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
    },
  );
  it('cannot settle missing charges, refunds, or inconsistent balance deltas', async () => {
    for (const evidence of [
      [],
      [{ ...entries[0], type: 'REFUND' }],
      [{ ...entries[0], balanceAfter: 10 }],
    ]) {
      entries = evidence;
      await expect(complete()).rejects.toThrow();
    }
    expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
  });
  it('preserves existing earning snapshots rather than resetting paid or reserved history', async () => {
    tx.astrologerEarning.findUnique.mockResolvedValue({
      status: 'PAID',
      platformFeePercent: 12,
    });
    await expect(complete()).rejects.toThrow('reconciliation');
    expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
  });
  it('rejects stale completion amounts and paid earnings for free chat', async () => {
    await expect(complete(2)).rejects.toThrow('amount changed');
    call.isFreeChat = true;
    await expect(complete()).rejects.toThrow('Free consultation');
    expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
  });
  it('duplicate completed termination is read-only', async () => {
    call.status = 'COMPLETED';
    call.endedAt = new Date();
    await complete();
    await complete();
    expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
    expect(tx.callSession.update).not.toHaveBeenCalled();
  });
});

describe('payout confirmation integrity (mock provider events)', () => {
  let service: AstrologerPayoutWebhookService, db: any, tx: any, payout: any;
  const event = {
    event: 'payout.processed',
    payload: {
      payout: { entity: { id: 'provider-fixture', status: 'processed' } },
    },
  };
  beforeEach(() => {
    payout = {
      id: 'payout',
      astrologerId: 'astro',
      currency: 'INR',
      amount: new Prisma.Decimal(70),
      status: 'PROCESSING',
      earnings: [
        {
          id: 'earning',
          astrologerId: 'astro',
          payoutId: 'payout',
          currency: 'INR',
          netAmount: new Prisma.Decimal(70),
          status: 'AVAILABLE',
          paidAt: null,
          reversedAt: null,
        },
      ],
    };
    tx = {
      astrologerPayout: {
        findUnique: jest.fn(async () => payout),
        update: jest.fn(async ({ data }) => Object.assign(payout, data)),
      },
      astrologerEarning: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    db = {
      astrologerPayout: { findFirst: jest.fn(async () => payout) },
      $transaction: jest.fn(async (run) => run(tx)),
    };
    service = new AstrologerPayoutWebhookService(db);
  });
  it('marks paid only on confirmed matching payout and ignores duplicate completion', async () => {
    await service.process(event);
    await service.process(event);
    expect(tx.astrologerEarning.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.astrologerEarning.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paidAt: null, reversedAt: null }),
      }),
    );
  });
  it.each(['PENDING', 'PAID', 'REVERSED'])(
    'does not pay %s earnings',
    async (status) => {
      payout.earnings[0].status = status;
      await expect(service.process(event)).rejects.toThrow();
      expect(tx.astrologerEarning.updateMany).not.toHaveBeenCalled();
    },
  );
  it.each(['amount', 'ownership', 'currency', 'reservation'])(
    'rejects %s mismatch',
    async (field) => {
      if (field === 'amount') payout.amount = new Prisma.Decimal(80);
      if (field === 'ownership') payout.earnings[0].astrologerId = 'foreign';
      if (field === 'currency') payout.earnings[0].currency = 'USD';
      if (field === 'reservation') payout.earnings[0].payoutId = 'foreign';
      await expect(service.process(event)).rejects.toThrow();
      expect(tx.astrologerPayout.update).not.toHaveBeenCalled();
    },
  );
  it('failed payouts are not resurrected as paid', async () => {
    payout.status = 'FAILED';
    await service.process(event);
    expect(tx.astrologerEarning.updateMany).not.toHaveBeenCalled();
  });
  it('failed provider events release reservations without marking paid; duplicate failure is a no-op', async () => {
    const failed = {
      event: 'payout.failed',
      payload: {
        payout: { entity: { id: 'provider-fixture', status: 'failed' } },
      },
    };
    await service.process(failed);
    await service.process(failed);
    expect(payout.status).toBe('FAILED');
    expect(tx.astrologerEarning.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.astrologerEarning.updateMany.mock.calls[0][0].data).toEqual({
      payoutId: null,
    });
  });
  it('post-completion reversal requires reconciliation and does not release paid earnings', async () => {
    payout.status = 'COMPLETED';
    await service.process({
      event: 'payout.reversed',
      payload: {
        payout: { entity: { id: 'provider-fixture', status: 'reversed' } },
      },
    });
    expect(payout.status).toBe('COMPLETED');
    expect(tx.astrologerEarning.updateMany).not.toHaveBeenCalled();
  });
});

describe('captured payment currency proof', () => {
  const verify = (PaymentsService.prototype as any)
    .assertCapturedCurrencyMatchesOrder;
  it.each([undefined, '', 'USD'])(
    'does not credit an unverified or mismatched currency %s',
    (currency) => {
      expect(() =>
        verify.call(
          { logger: { error: jest.fn() } },
          { currency: 'INR' },
          { currency },
        ),
      ).toThrow();
    },
  );
  it('accepts a matching captured currency', () => {
    expect(() =>
      verify.call({}, { currency: 'INR' }, { currency: 'INR' }),
    ).not.toThrow();
  });
});

describe('earning release eligibility', () => {
  it('does not release paid, reversed or withdrawal-reserved earnings', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await new EarningReleaseProcessor({
      astrologerEarning: { updateMany },
    } as any).releaseEligibleEarnings();
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        availableAt: { lte: expect.any(Date) },
        paidAt: null,
        reversedAt: null,
        payoutId: null,
      },
      data: { status: 'AVAILABLE' },
    });
  });
});

describe('withdrawal reservation invariants (serialized in-memory fixture, not PostgreSQL)', () => {
  const originalPayoutFlag = process.env.FINANCIAL_PAYOUTS_ENABLED;
  beforeEach(() => {
    process.env.FINANCIAL_PAYOUTS_ENABLED = 'true';
  });
  afterEach(() => {
    if (originalPayoutFlag === undefined)
      delete process.env.FINANCIAL_PAYOUTS_ENABLED;
    else process.env.FINANCIAL_PAYOUTS_ENABLED = originalPayoutFlag;
  });
  it('default-disabled payouts perform no account, reservation or provider access', async () => {
    delete process.env.FINANCIAL_PAYOUTS_ENABLED;
    const isolated: any = Object.create(AstrologerService.prototype);
    isolated.findAstrologerBySupabaseId = jest.fn();
    await expect(isolated.requestPayout('subject')).rejects.toThrow('disabled');
    expect(isolated.findAstrologerBySupabaseId).not.toHaveBeenCalled();
  });
  let service: AstrologerService,
    db: any,
    tx: any,
    provider: any,
    rows: any[],
    reserved: any;
  beforeEach(() => {
    reserved = null;
    rows = [
      {
        id: 'earning',
        status: 'AVAILABLE',
        payoutId: null,
        netAmount: new Prisma.Decimal(70),
        currency: 'INR',
      },
    ];
    tx = {
      astrologerPayout: {
        findFirst: jest.fn(async () => reserved),
        create: jest.fn(
          async ({ data }) => (reserved = { id: 'payout', ...data }),
        ),
      },
      astrologerEarning: {
        findMany: jest.fn(async ({ where }) => {
          expect(where).toMatchObject({
            astrologerId: 'astro',
            status: 'AVAILABLE',
            payoutId: null,
          });
          return rows.filter(
            (row) => row.status === 'AVAILABLE' && row.payoutId === null,
          );
        }),
        updateMany: jest.fn(async ({ data }) => {
          let count = 0;
          for (const row of rows)
            if (row.status === 'AVAILABLE' && row.payoutId === null) {
              row.payoutId = data.payoutId;
              count++;
            }
          return { count };
        }),
      },
    };
    let tail = Promise.resolve();
    db = {
      astrologerBankAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'bank',
          providerFundAccountId: 'fund',
          accountNumberLast4: '0000',
        }),
      },
      astrologerPayout: {
        update: jest.fn(async ({ data }) => Object.assign(reserved, data)),
      },
      $transaction: jest.fn((run) => {
        const work = tail.then(() => run(tx));
        tail = work.catch(() => {});
        return work;
      }),
    };
    provider = {
      createPayout: jest
        .fn()
        .mockResolvedValue({ id: 'provider-fixture', status: 'processing' }),
    };
    service = new AstrologerService(db, {} as any, provider);
    jest
      .spyOn(service as any, 'findAstrologerBySupabaseId')
      .mockResolvedValue({ id: 'astro', isApproved: true });
  });
  it('pending earnings cannot be withdrawn', async () => {
    rows[0].status = 'PENDING';
    await expect(service.requestPayout('subject')).rejects.toThrow(
      'No available',
    );
    expect(provider.createPayout).not.toHaveBeenCalled();
  });
  it('a missing verified bank blocks withdrawal before reserving funds', async () => {
    db.astrologerBankAccount.findFirst.mockResolvedValue(null);
    await expect(service.requestPayout('subject')).rejects.toThrow('verified');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(provider.createPayout).not.toHaveBeenCalled();
  });
  it('concurrent requests reserve a given earning only once', async () => {
    const results = await Promise.allSettled([
      service.requestPayout('subject'),
      service.requestPayout('subject'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(provider.createPayout).toHaveBeenCalledTimes(1);
    expect(rows[0].payoutId).toBe('payout');
    expect(db.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
  it('provider uncertainty retains reservation and idempotency key without marking PAID', async () => {
    provider.createPayout.mockRejectedValue(new Error('mock uncertainty'));
    await expect(service.requestPayout('subject')).rejects.toThrow();
    expect(rows[0].payoutId).toBe('payout');
    expect(rows[0].status).toBe('AVAILABLE');
    expect(reserved.status).toBe('REQUESTED');
    expect(reserved.idempotencyKey).toBeDefined();
  });
});
