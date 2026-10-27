import { Prisma, LedgerType } from '@prisma/client';
import { CallService } from './call.service';

describe('call lifecycle protections (in-memory only)', () => {
  let service: CallService, tx: any, db: any, call: any, earning: any, entries: any[];
  beforeEach(() => {
    call = { id: 'call', userId: 'customer', astrologerId: 'astro', status: 'ACTIVE', endedAt: null,
      expiresAt: new Date(Date.now() + 60000), startedAt: new Date(), amountCharged: 50, isFreeChat: false,
      astrologer: { id: 'astro', name: 'Astrologer' }, ratePerMinute: 10, extendedMinutes: 0 };
    earning = null;
    entries = [{ type: LedgerType.CALL_DEDUCTION, amount: new Prisma.Decimal(50), balanceBefore: 100, balanceAfter: 50 }];
    tx = {
      callSession: { findFirst: jest.fn(async () => call), findUnique: jest.fn(async () => call),
        update: jest.fn(async ({ data }) => Object.assign(call, data)) },
      astrologerEarning: { findUnique: jest.fn(async () => earning), create: jest.fn(async ({ data }) => earning = { id: 'earning', ...data }) },
      walletLedger: { findMany: jest.fn(async () => entries), create: jest.fn() },
      astrologer: { findUnique: jest.fn(async () => ({ id: 'profile' })) },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
    };
    // Serialize fixture transactions to model winner/loser states, not PostgreSQL isolation.
    let tail = Promise.resolve();
    db = { $transaction: jest.fn((run) => { const result = tail.then(() => run(tx)); tail = result.catch(() => {}); return result; }) };
    service = new CallService(db, {} as any);
    jest.spyOn(service as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'customer' });
    jest.spyOn(service as any, 'getPlatformFeePercent').mockResolvedValue(30);
  });
  it.each(['PENDING', 'REJECTED', 'CANCELLED', 'EXPIRED'])('never creates earnings for %s', async status => {
    call.status = status;
    try { await service.endCall('subject', 'call', {}); } catch (_) { /* PENDING fails closed. */ }
    expect(tx.astrologerEarning.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it.each([{ rows: [] }, { rows: [{ type: LedgerType.REFUND, amount: 50, balanceBefore: 50, balanceAfter: 100 }] },
    { rows: [{ type: LedgerType.CALL_DEDUCTION, amount: 50, balanceBefore: 100, balanceAfter: 100 }] }])('rejects missing or unproven debit evidence', async evidence => {
    entries = evidence.rows;
    await expect(service.endCall('subject', 'call', {})).rejects.toThrow();
    expect(tx.callSession.update).not.toHaveBeenCalled();
    expect(tx.astrologerEarning.create).not.toHaveBeenCalled();
  });
  it('accepts historical signed deduction conventions with matching balance deltas', async () => {
    entries[0].amount = new Prisma.Decimal(-50);
    await service.endCall('subject', 'call', {});
    expect(tx.astrologerEarning.create).toHaveBeenCalledTimes(1);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });
  it('repeated and simultaneous ends preserve the first timestamp and earning', async () => {
    await Promise.all([service.endCall('subject', 'call', {}), service.endCall('subject', 'call', {})]);
    const endedAt = call.endedAt;
    await service.endCall('subject', 'call', {});
    expect(tx.astrologerEarning.create).toHaveBeenCalledTimes(1);
    expect(tx.callSession.update).toHaveBeenCalledTimes(1);
    expect(call.endedAt).toBe(endedAt);
    expect(tx.walletLedger.create).not.toHaveBeenCalled();
  });
  it('does not recreate historical missing earnings on a completed call', async () => {
    call.status = 'COMPLETED'; call.endedAt = new Date();
    const result = await service.endCall('subject', 'call', {});
    expect(result.data.earning).toBeNull();
    expect(tx.astrologerEarning.create).not.toHaveBeenCalled();
  });
  it('rejects foreign ownership before financial writes', async () => {
    tx.callSession.findFirst.mockResolvedValue(null);
    await expect(service.endCall('foreign', 'call', {})).rejects.toThrow();
    expect(tx.astrologerEarning.create).not.toHaveBeenCalled();
  });
  it.each([-1, 0])('rejects extension at expiry boundary %s ms', async delta => {
    call.expiresAt = new Date(Date.now() + delta);
    await expect(service.extendCall('subject', 'call', { minutes: 5 })).rejects.toThrow();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it('end winning the serialized race prevents a later extension', async () => {
    await service.endCall('subject', 'call', {});
    await expect(service.extendCall('subject', 'call', { minutes: 5 })).rejects.toThrow();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'ENDED', 'CANCELLED', 'REJECTED'])('cannot extend %s', async status => {
    call.status = status;
    await expect(service.extendCall('subject', 'call', { minutes: 5 })).rejects.toThrow();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  it('unaccepted free-chat cannot enter the legacy earnings path', async () => {
    call.isFreeChat = true; call.amountCharged = 0;
    await expect(service.endCall('subject', 'call', {})).rejects.toThrow();
    expect(tx.astrologerEarning.create).not.toHaveBeenCalled();
  });
});

describe('consultation-bounded RTC issuance (mock database)', () => {
  it.each(['PENDING', 'ENDED', 'CANCELLED', 'EXPIRED'])('only queries eligible ACTIVE sessions, rejecting %s', async () => {
    const token = jest.fn();
    const db: any = { callSession: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CallService(db, { generateRtcToken: token } as any);
    jest.spyOn(service as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'customer' });
    jest.spyOn(service as any, 'expireCallIfRequired').mockResolvedValue(undefined);
    await expect(service.generateAgoraToken('subject', 'call')).rejects.toThrow();
    expect(db.callSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      status: 'ACTIVE', endedAt: null, expiresAt: { gt: expect.any(Date) },
      OR: [{ userId: 'customer' }, { astrologerId: 'customer' }],
    }) }));
    expect(token).not.toHaveBeenCalled();
  });
  it('rejects the sub-second expiry boundary even if eligibility was read earlier', async () => {
    const token = jest.fn();
    const db: any = { callSession: { findFirst: jest.fn().mockResolvedValue({
      id: 'call', userId: 'customer', astrologerId: 'astro', mode: 'audio', channelName: 'channel', expiresAt: new Date(Date.now() + 100),
    }) } };
    const service = new CallService(db, { generateRtcToken: token } as any);
    jest.spyOn(service as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'customer' });
    jest.spyOn(service as any, 'expireCallIfRequired').mockResolvedValue(undefined);
    await expect(service.generateAgoraToken('subject', 'call')).rejects.toThrow();
    expect(token).not.toHaveBeenCalled();
  });
});
