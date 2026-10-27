jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: jest.fn(() => []), initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { Prisma } from '@prisma/client';
import { ConsultationRepository } from './consultation.repository';
import { UserService } from '../user/user.service';
import { CallService } from '../call/call.service';

describe('Free Chat lifecycle with synthetic in-memory persistence', () => {
  let tx: any, repo: ConsultationRepository, user: any, calls: any[], wallet: any;
  const gates = ['FINANCIAL_LIFECYCLE_V2_ENABLED', 'FINANCIAL_SCHEMA_READY'];
  const previous = Object.fromEntries(gates.map(key => [key, process.env[key]]));
  afterEach(() => { for (const key of gates) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  beforeEach(() => {
    user = { id: 'customer', freeChatGrantedAt: new Date(), freeChatUsedAt: null, freeChatMinutes: 1 };
    calls = [];
    wallet = { id: 'wallet', balance: new Prisma.Decimal(100), lockedBalance: new Prisma.Decimal(0), currency: 'INR' };
    tx = {
      user: { updateMany: jest.fn(async () => { if (user.freeChatUsedAt) return { count: 0 }; user.freeChatUsedAt = new Date(); return { count: 1 }; }),
        update: jest.fn(async ({ data }) => Object.assign(user, data)) },
      wallet: { upsert: jest.fn(async () => wallet), findUnique: jest.fn(async () => wallet), update: jest.fn(async ({ data }) => Object.assign(wallet, data)) },
      callSession: {
        findFirst: jest.fn(async (q) => q.orderBy ? calls.find(c => c.status === 'PENDING' && !c.endedAt) ?? null :
          calls.find(c => !c.endedAt && (q.where.status ? c.status === q.where.status && c.id !== q.where.id?.not : true)) ?? null),
        create: jest.fn(async ({ data }) => { const call = { id: `call-${calls.length}`, endedAt: null, ...data }; calls.push(call); return call; }),
        findUnique: jest.fn(async ({ where }) => calls.find(c => c.id === where.id) ?? null),
        findUniqueOrThrow: jest.fn(async ({ where }) => calls.find(c => c.id === where.id)),
        update: jest.fn(async ({ where, data }) => Object.assign(calls.find(c => c.id === where.id), data)),
      },
      astrologerEarning: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      walletLedger: { create: jest.fn(), findMany: jest.fn() },
      astrologer: { findUnique: jest.fn().mockResolvedValue({ id: 'astro-profile' }) },
      $executeRaw: jest.fn(), $queryRaw: jest.fn(),
    };
    // Calls are deliberately sequential: these tests do not simulate PostgreSQL MVCC.
    repo = new ConsultationRepository({ $transaction: jest.fn(run => run(tx)) } as any);
  });
  async function request() { return repo.createConsultation({ userId: 'customer', astrologerId: 'astro', mode: 'chat',
    purchasedMinutes: 1, requireFreeChat: true, ratePerMinute: 100, amountCharged: 100,
    channelName: 'synthetic-channel', status: 'PENDING', startedAt: new Date(), expiresAt: new Date(Date.now() + 120000) }); }
  function noFinancialPosting() {
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletLedger.create).not.toHaveBeenCalled();
    expect(tx.astrologerEarning.upsert).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(wallet.balance.toString()).toBe('100');
    expect(wallet.lockedBalance.toString()).toBe('0');
  }
  it('request -> acceptance -> completion -> duplicate completion retains a single free benefit and no postings', async () => {
    const result = await request();
    expect(result.consultation.isFreeChat).toBe(true);
    expect(result.consultation.amountCharged).toBe(0);
    await repo.acceptConsultation('call-0');
    expect(calls[0].status).toBe('ACTIVE');
    await repo.completeConsultation('call-0', { amountCharged: 0, platformFeePercent: 0 });
    expect(calls[0].status).toBe('COMPLETED');
    expect(user.freeChatUsedAt).not.toBeNull();
    await repo.completeConsultation('call-0', { amountCharged: 0, platformFeePercent: 0 });
    await expect(request()).rejects.toThrow('Free chat is no longer available');
    noFinancialPosting();
  });
  it.each(['REJECTED', 'CANCELLED', 'EXPIRED'])('%s releases pending benefit exactly once without wallet changes', async status => {
    await request();
    await repo.cancelConsultation('call-0', status);
    expect(user.freeChatUsedAt).toBeNull();
    await expect(repo.cancelConsultation('call-0', status)).rejects.toThrow('already ended');
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    await request();
    expect(calls[1].isFreeChat).toBe(true);
    noFinancialPosting();
  });
  it('cannot extend Free Chat into paid Chat', async () => {
    await request(); await repo.acceptConsultation('call-0');
    await expect(repo.extendConsultation('call-0', { additionalMinutes: 5, additionalAmount: 500, newExpiresAt: new Date() })).rejects.toThrow('cannot be extended');
    noFinancialPosting();
  });
  it('legacy call extension cannot bypass the free-only boundary', async () => {
    await request(); await repo.acceptConsultation('call-0');
    const service = new CallService({ $transaction: jest.fn(run => run(tx)) } as any, {} as any);
    jest.spyOn(service as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'customer' });
    await expect(service.extendCall('synthetic', 'call-0', { minutes: 5 })).rejects.toThrow('cannot be extended');
    noFinancialPosting();
  });
  it('free lifecycle remains financially isolated even when paid rollout gates are enabled in the test process', async () => {
    for (const key of gates) process.env[key] = 'true';
    await request(); await repo.acceptConsultation('call-0');
    await repo.completeConsultation('call-0', { amountCharged: 0, platformFeePercent: 0 });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    noFinancialPosting();
  });
  it('preserves historical earning entries and requires explicit reconciliation', async () => {
    await request(); await repo.acceptConsultation('call-0');
    tx.astrologerEarning.findUnique.mockResolvedValue({ id: 'existing-zero-earning' });
    await expect(repo.completeConsultation('call-0', { amountCharged: 0, platformFeePercent: 0 })).rejects.toThrow('reconciliation');
    noFinancialPosting();
  });
});

describe('Fresh session entitlement is server authoritative and read only', () => {
  it.each([false, true])('returns current used=%s rather than old login claims', async used => {
    const service: any = Object.create(UserService.prototype);
    service.getUserWithRelations = jest.fn().mockResolvedValue({ id: 'canonical', isActive: true, isBlocked: false,
      freeChatGrantedAt: new Date(), freeChatUsedAt: used ? new Date() : null, freeChatMinutes: 1 });
    service.prisma = { callSession: { findFirst: jest.fn().mockResolvedValue(null) } };
    const result = await service.getSessionState('verified-subject', 'customer');
    expect(result.user.freeChat).toEqual({ eligible: !used, used, minutes: 1, showPopup: !used });
  });
  it('active consultation suppresses popup without consuming the entitlement', async () => {
    const service: any = Object.create(UserService.prototype);
    service.getUserWithRelations = jest.fn().mockResolvedValue({ id: 'canonical', isActive: true, isBlocked: false,
      freeChatGrantedAt: new Date(), freeChatUsedAt: null, freeChatMinutes: 1 });
    service.prisma = { callSession: { findFirst: jest.fn().mockResolvedValue({ id: 'active-paid' }) } };
    const result = await service.getSessionState('verified-subject', 'customer');
    expect(result.user.freeChat.eligible).toBe(true);
    expect(result.user.freeChat.showPopup).toBe(false);
  });
});
