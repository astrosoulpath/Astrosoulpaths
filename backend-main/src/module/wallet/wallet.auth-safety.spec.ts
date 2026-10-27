import { WalletService } from './wallet.service';
import { Prisma } from '@prisma/client';
describe('Authenticated customer wallet without phone prerequisite', () => {
  let db: any; let service: WalletService;
  beforeEach(() => {
    db = { userAuthIdentity: { findUnique: jest.fn().mockResolvedValue({ userId: 'canonical' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'canonical', isActive: true, isBlocked: false, phone: null }) },
      wallet: { upsert: jest.fn().mockResolvedValue({ id: 'wallet', balance: new Prisma.Decimal(42), paidBalance: new Prisma.Decimal(42), freeBalance: new Prisma.Decimal(0), lockedBalance: new Prisma.Decimal(0), currency: 'INR' }) } };
    service = new WalletService(db);
  });
  it('allows authenticated Google/email customer without a verified phone', async () => {
    const result = await service.getWallet('mapped-subject');
    expect(result.data.balance).toBe(42);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'canonical' } }));
    expect(db.wallet.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'canonical' }, update: {} }));
  });
  it.each(['', ' '])('rejects missing authenticated identity %j', async (subject) => {
    await expect(service.getWallet(subject)).rejects.toThrow(); expect(db.wallet.upsert).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false, isBlocked: false }, { isActive: true, isBlocked: true }])('denies unavailable account %j', async (status) => {
    db.user.findUnique.mockResolvedValue({ id: 'canonical', ...status });
    await expect(service.getWallet('subject')).rejects.toThrow(); expect(db.wallet.upsert).not.toHaveBeenCalled();
  });
  it('never creates a user or wallet for an unknown canonical mapping', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.getWallet('unknown')).rejects.toThrow(); expect(db.wallet.upsert).not.toHaveBeenCalled();
  });
});
