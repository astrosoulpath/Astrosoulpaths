jest.mock('../chat/chat.gateway', () => ({ ChatGateway: class {} }));
jest.mock('../notifications/notifications.push.service', () => ({ NotificationsPushService: class {} }));
import { ConsultationRepository } from './consultation.repository';
import { ConsultationService } from './consultation.service';

describe('Free-only request cannot become paid', () => {
  it('rejects a racing lost entitlement before any wallet/session operation', async () => {
    const tx = { user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      wallet: { update: jest.fn() }, callSession: { create: jest.fn(), findFirst: jest.fn() } };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const repository = new ConsultationRepository(prisma as any);
    await expect(repository.createConsultation({ userId: 'synthetic', mode: 'chat',
      purchasedMinutes: 1, requireFreeChat: true } as any)).rejects.toThrow('Free chat is no longer available');
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.callSession.create).not.toHaveBeenCalled();
    expect(tx.callSession.findFirst).not.toHaveBeenCalled();
  });
  it.each([null, 'true', 1])('rejects malformed free-only intent %p', async (intent) => {
    const db = { user: { findFirst: jest.fn() } };
    const service = new ConsultationService({} as any, db as any, {} as any, {} as any);
    await expect(service.startConsultation({ requireFreeChat: intent } as any)).rejects.toThrow('Invalid free chat intent');
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
  it.each(['chat', 'audio'])('rejects stale entitlement for %s before reservation', async (mode) => {
    const db = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'customer', isActive: true,
      isBlocked: false, freeChatGrantedAt: new Date(), freeChatUsedAt: new Date(), freeChatMinutes: 1 }) } };
    const repository = { createConsultation: jest.fn() };
    const service = new ConsultationService(repository as any, db as any, {} as any, {} as any);
    await expect(service.startConsultation({ userId: 'customer', astrologerUserId: 'astrologer',
      mode, purchasedMinutes: 1, requireFreeChat: true } as any)).rejects.toThrow('Free chat is no longer available');
    expect(repository.createConsultation).not.toHaveBeenCalled();
  });
});
