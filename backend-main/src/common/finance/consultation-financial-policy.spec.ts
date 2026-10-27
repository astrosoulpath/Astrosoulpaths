import { Prisma } from '@prisma/client';
import {
  approvedReleaseAt,
  financialLifecycleEnabled,
  readFinancialPolicy,
  snapshotCommission,
} from './consultation-financial-policy';
import { CallService } from '../../module/call/call.service';
import { ConsultationRepository } from '../../module/consultation/consultation.repository';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AdminService } from '../../module/admin/admin.service';

describe('financial rollout and locked policy (mock only)', () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.FINANCIAL_LIFECYCLE_V2_ENABLED;
    delete process.env.FINANCIAL_SCHEMA_READY;
    delete process.env.FINANCIAL_APPROVED_HOLD_SECONDS;
  });
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });
  function enable() {
    process.env.FINANCIAL_LIFECYCLE_V2_ENABLED = 'true';
    process.env.FINANCIAL_SCHEMA_READY = 'true';
  }
  it('default and partially enabled rollout never access missing schema', async () => {
    const tx: any = { $queryRaw: jest.fn() };
    expect(financialLifecycleEnabled()).toBe(false);
    expect(await readFinancialPolicy(tx, 'old')).toBeNull();
    process.env.FINANCIAL_LIFECYCLE_V2_ENABLED = 'true';
    expect(await readFinancialPolicy(tx, 'old')).toBeNull();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it('enabled rollout fails closed on missing schema rather than falling back', async () => {
    enable();
    await expect(
      readFinancialPolicy(
        {
          $queryRaw: jest
            .fn()
            .mockRejectedValue(new Error('synthetic missing schema')),
        } as any,
        'call',
      ),
    ).rejects.toThrow();
  });
  it.each([undefined, '-1', '1.5', 'NaN', '31536001'])(
    'requires approved release configuration: %s',
    (value) => {
      if (value !== undefined)
        process.env.FINANCIAL_APPROVED_HOLD_SECONDS = value;
      expect(() => approvedReleaseAt(new Date())).toThrow();
    },
  );
  it('uses explicit approved timing without a default 24-hour hold', () => {
    process.env.FINANCIAL_APPROVED_HOLD_SECONDS = '60';
    expect(approvedReleaseAt(new Date(0)).getTime()).toBe(60000);
  });
  it('creation locks policy before reading settings and persists a stable snapshot', async () => {
    const tx: any = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      platformSettings: {
        findUnique: jest.fn().mockResolvedValue({
          platformCommissionPercent: new Prisma.Decimal(30),
          updatedAt: new Date(0),
        }),
      },
    };
    await snapshotCommission(tx, 'call');
    const initial = tx.$executeRaw.mock.calls[0];
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.platformSettings.findUnique.mock.invocationCallOrder[0],
    );
    expect(initial[2].toString()).toBe('30');
    tx.platformSettings.findUnique.mockResolvedValue({
      platformCommissionPercent: 10,
    });
    enable();
    tx.$queryRaw.mockResolvedValue([
      { platformPercent: new Prisma.Decimal(30), lifecycle: 'CONSULTATION_V2' },
    ]);
    expect(
      Number((await readFinancialPolicy(tx, 'call'))!.platformPercent),
    ).toBe(30);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('does not infer or backfill historical origin', async () => {
    enable();
    expect(
      await readFinancialPolicy(
        { $queryRaw: jest.fn().mockResolvedValue([]) } as any,
        'old',
      ),
    ).toBeNull();
  });
  it.each(['chat', 'audio', 'video'])(
    'completion uses locked percentage for %s after Admin changes',
    async (mode) => {
      enable();
      process.env.FINANCIAL_APPROVED_HOLD_SECONDS = '60';
      const call: any = {
        id: 'call',
        mode,
        status: 'ACTIVE',
        userId: 'customer',
        astrologerId: 'astro',
        amountCharged: 100,
        isFreeChat: false,
      };
      const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            platformPercent: new Prisma.Decimal(30),
            lifecycle: 'CONSULTATION_V2',
          },
        ]),
        callSession: {
          findUnique: jest.fn(async () => call),
          update: jest.fn(async ({ data }) => Object.assign(call, data)),
          findUniqueOrThrow: jest.fn(async () => call),
        },
        astrologerEarning: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn(),
        },
        astrologer: {
          findUnique: jest.fn().mockResolvedValue({ id: 'astro-profile' }),
        },
        walletLedger: {
          findMany: jest.fn().mockResolvedValue([
            {
              type: 'CALL_DEDUCTION',
              amount: 100,
              balanceBefore: 150,
              balanceAfter: 50,
            },
          ]),
        },
      };
      const repo = new ConsultationRepository({
        $transaction: async (fn) => fn(tx),
      } as any);
      await repo.completeConsultation('call', {
        amountCharged: 100,
        platformFeePercent: 10,
        endedAt: new Date(0),
      });
      const earning = tx.astrologerEarning.upsert.mock.calls[0][0].create;
      expect(Number(earning.platformFeePercent)).toBe(30);
      expect(Number(earning.netAmount)).toBe(70);
      expect(earning.status).toBe('PENDING');
      expect(earning.availableAt.getTime()).toBe(60000);
      await repo.completeConsultation('call', {
        amountCharged: 100,
        platformFeePercent: 90,
      });
      expect(tx.astrologerEarning.upsert).toHaveBeenCalledTimes(1);
    },
  );
  it.each([false, true])(
    'audit and configuration use the same transaction; audit failure=%s',
    async (fails) => {
      enable();
      const tx: any = {
        $queryRaw: jest.fn(),
        $executeRaw: fails
          ? jest.fn().mockRejectedValue(new Error('synthetic audit failure'))
          : jest.fn(),
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'admin',
            isActive: true,
            isBlocked: false,
          }),
        },
        platformSettings: {
          findUnique: jest.fn().mockResolvedValue({
            platformCommissionPercent: new Prisma.Decimal(30),
          }),
          upsert: jest.fn().mockResolvedValue({
            platformCommissionPercent: new Prisma.Decimal(20),
          }),
        },
        appConfig: { update: jest.fn().mockResolvedValue({}) },
      };
      const service: any = Object.create(AdminService.prototype);
      service.adminRepository = {
        getPlatformSettings: jest.fn().mockResolvedValue({
          platformCommissionPercent: new Prisma.Decimal(30),
        }),
      };
      service.prisma = {
        appConfig: { findUnique: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn(async (fn) => fn(tx)),
      };
      const operation = service.updatePlatformSettings(
        { platformCommissionPercent: 20 },
        'verified-subject',
      );
      if (fails) {
        await expect(operation).rejects.toThrow('synthetic audit failure');
        expect(tx.platformSettings.upsert).not.toHaveBeenCalled();
      } else {
        expect((await operation).data.platformCommissionPercent).toBe(20);
        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        expect(tx.$executeRaw.mock.calls[0][2]).toBe('admin');
      }
    },
  );
  it.each(['audio', 'video'])(
    'marked %s end delegates once per request to idempotent consultation completion, never legacy earnings',
    async (mode) => {
      enable();
      const call = {
        id: 'call',
        mode,
        amountCharged: 50,
        status: 'COMPLETED',
        earning: null,
      };
      const db: any = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            platformPercent: new Prisma.Decimal(30),
            lifecycle: 'CONSULTATION_V2',
          },
        ]),
        callSession: { findFirst: jest.fn().mockResolvedValue(call) },
        $transaction: jest.fn(),
      };
      const service = new CallService(db, {} as any);
      jest
        .spyOn(service as any, 'getAuthenticatedUser')
        .mockResolvedValue({ id: 'customer' });
      jest
        .spyOn(service as any, 'serializeCallSession')
        .mockImplementation((x) => x);
      const complete = jest
        .spyOn(ConsultationRepository.prototype, 'completeConsultation')
        .mockResolvedValue(call as any);
      await service.endCall('subject', 'call', {});
      await service.endCall('subject', 'call', {});
      expect(complete).toHaveBeenCalledTimes(2);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it('review SQL forbids mutation of policy/audit and does not update old sessions', () => {
    const sql = readFileSync(
      join(
        __dirname,
        '../../../review/finance/step-1-financial-policy.review.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('BEFORE UPDATE OR DELETE');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).not.toMatch(
      /ALTER TABLE public\."CallSession"|UPDATE public\."CallSession"/,
    );
  });
});
