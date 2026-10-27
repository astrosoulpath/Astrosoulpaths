jest.mock('../chat/chat.gateway', () => ({ ChatGateway: class {} }));
jest.mock('../notifications/notifications.push.service', () => ({ NotificationsPushService: class {} }));
import { ConsultationService } from './consultation.service';
import { CallService } from '../call/call.service';
import { ArticlesService } from '../articles/articles.service';

describe('Protected astrologer operations', () => {
  let db: any, repository: any, service: ConsultationService;
  beforeEach(() => {
    db = { astrologer: { findUnique: jest.fn().mockResolvedValue({ isApproved: false, isVerified: false,
      user: { isActive: true, isBlocked: false, isAstrologer: false } }) } };
    repository = { ensureConsultationExists: jest.fn(), findActiveAstrologerConsultation: jest.fn().mockResolvedValue([]),
      findAstrologerConsultationHistory: jest.fn() };
    service = new ConsultationService(repository, db, {} as any, {} as any);
  });
  it.each(['acceptConsultation', 'rejectConsultation'])('blocks pending %s before accepting or rejecting a consultation', async (name) => {
    await expect((service as any)[name]({ consultationId: 'call', astrologerUserId: 'pending' })).rejects.toThrow('Admin approval');
    expect(repository.ensureConsultationExists).not.toHaveBeenCalled();
  });
  it.each(['getCurrentAstrologerConsultation', 'getAstrologerConsultationHistory'])('blocks pending %s', async (name) => {
    await expect((service as any)[name]('pending')).rejects.toThrow('Admin approval');
  });
  it('approved astrologer can inspect current consultations', async () => {
    db.astrologer.findUnique.mockResolvedValue({ isApproved: true, isVerified: true,
      user: { isActive: true, isBlocked: false, isAstrologer: true } });
    expect((await service.getCurrentAstrologerConsultation('approved')).success).toBe(true);
    expect(repository.findActiveAstrologerConsultation).toHaveBeenCalledWith('approved');
  });
  it('revoked approval prevents issuing an astrologer RTC token', async () => {
    const agora: any = { generateRtcToken: jest.fn() };
    db.callSession = { findFirst: jest.fn().mockResolvedValue({ id: 'call', astrologerId: 'pending', userId: 'customer', mode: 'audio' }) };
    const calls = new CallService(db, agora);
    jest.spyOn(calls as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'pending' });
    jest.spyOn(calls as any, 'expireCallIfRequired').mockResolvedValue(undefined);
    await expect(calls.generateAgoraToken('subject', 'call')).rejects.toThrow('Admin approval');
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('customer RTC access does not require an astrologer capability', async () => {
    const agora: any = { generateRtcToken: jest.fn().mockReturnValue({ token: 'unit-rtc-token' }) };
    db.callSession = { findFirst: jest.fn().mockResolvedValue({ id: 'call', astrologerId: 'astro', userId: 'customer', mode: 'audio', channelName: 'unit-channel', expiresAt: new Date(Date.now() + 60000) }) };
    const calls = new CallService(db, agora);
    jest.spyOn(calls as any, 'getAuthenticatedUser').mockResolvedValue({ id: 'customer' });
    jest.spyOn(calls as any, 'expireCallIfRequired').mockResolvedValue(undefined);
    expect((await calls.generateAgoraToken('subject', 'call')).success).toBe(true);
    expect(db.astrologer.findUnique).not.toHaveBeenCalled();
  });
  it('article management requires verified approval and active capability', async () => {
    const articles = new ArticlesService({ userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, isBlocked: false, isAstrologer: true,
        astrologer: { isApproved: true, isVerified: false } }) } } as any);
    await expect((articles as any).approvedAstrologer('subject')).rejects.toThrow('approved');
  });
});
