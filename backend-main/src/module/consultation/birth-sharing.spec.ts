import { BirthSharingService, BIRTH_SHARING_NOTICE, sharedBirthDetails } from './birth-sharing.service';
import { createHash } from 'crypto';

describe('Consultation scoped birth sharing', () => {
  let tx: any, service: BirthSharingService, call: any, profile: any, consent: any;
  const oldFlag = process.env.CONSULTATION_BIRTH_SHARING_ENABLED;
  afterAll(() => { if (oldFlag === undefined) delete process.env.CONSULTATION_BIRTH_SHARING_ENABLED; else process.env.CONSULTATION_BIRTH_SHARING_ENABLED = oldFlag; });
  beforeEach(() => {
    process.env.CONSULTATION_BIRTH_SHARING_ENABLED = 'true';
    call = { id: 'consultation', userId: 'customer', astrologerId: 'astrologer', mode: 'chat', status: 'ACTIVE', endedAt: null, expiresAt: new Date(Date.now() + 60000) };
    profile = { id: 'primary', fullName: 'Synthetic Customer', dateOfBirth: new Date('2000-01-01'), timeOfBirth: '10:30', birthTimeKnown: true, city: 'Synthetic city', gender: 'OTHER' };
    consent = null;
    tx = { $queryRaw: jest.fn(async (sql: TemplateStringsArray) => sql.join('').includes('SELECT *') ? (consent ? [consent] : []) : []), $executeRaw: jest.fn(),
      callSession: { findUnique: jest.fn(async () => call) }, user: { findMany: jest.fn().mockResolvedValue([
        { id: 'customer', isActive: true, isBlocked: false, role: {name:'CUSTOMER'} }, { id: 'astrologer', name: 'Synthetic Astrologer', isActive: true, isBlocked: false, role: {name:'ASTROLOGER'} }]) },
      astrologer: { findUnique: jest.fn().mockResolvedValue({ isApproved: true, isVerified: true }) },
      userProfile: { findUnique: jest.fn(async () => profile), findFirst: jest.fn(async () => profile) }, profile: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) } };
    service = new BirthSharingService({ $transaction: jest.fn(callback => callback(tx)) } as any);
  });
  function allow() { consent = { customerId: 'customer', astrologerId: 'astrologer', policyVersion: BIRTH_SHARING_NOTICE,
    profileRef: 'user:primary', revision: 1, expiresAt: call.expiresAt, revokedAt: null, birthVersion: createHash('sha256').update(JSON.stringify({profileRef: 'user:primary', details: sharedBirthDetails(profile)})).digest('hex') }; }
  it('requires explicit selection even for a single profile', async () => {
    const result = await service.access('customer', 'consultation', 'read');
    expect(result.state).toBe('PROFILE_SELECTION_REQUIRED');
    expect(result.details).toBeNull();
    expect(result.profiles).toEqual([{profileRef:'user:primary', label:'Synthetic Customer'}]);
  });
  it('allows revocation without reselecting a profile after reopening', async () => {
    allow();
    const result = await service.access('customer','consultation','read');
    expect(result.canRevoke).toBe(true);
    expect(result.details).toBeNull();
  });
  it('rejects a foreign profile without loading its protected fields', async () => {
    await expect(service.access('customer','consultation','read',undefined,undefined,'saved:foreign')).rejects.toThrow('Select an owned');
    expect(tx.profile.findFirst).not.toHaveBeenCalled();
  });
  it('rejects stale grant replay after revocation', async () => {
    allow(); consent.revokedAt = new Date(); consent.revision = 2;
    await expect(service.access('customer','consultation','grant',BIRTH_SHARING_NOTICE,consent.birthVersion,'user:primary',1)).rejects.toThrow('Refresh permission');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('supports an explicitly selected saved family profile', async () => {
    tx.profile.findMany.mockResolvedValue([{id:'family',name:'Synthetic family'}]);
    tx.profile.findFirst.mockResolvedValue({name:'Synthetic family',birthDate:new Date('1990-01-01'),birthTime:'09:30',city:'Synthetic city'});
    const result=await service.access('customer','consultation','read',undefined,undefined,'saved:family');
    expect(result.details?.fullName).toBe('Synthetic family');
    expect(result.profileRef).toBe('saved:family');
  });
  it('default off before accessing the database', async () => {
    delete process.env.CONSULTATION_BIRTH_SHARING_ENABLED;
    await expect(service.access('customer', 'consultation', 'read')).rejects.toThrow('not activated');
    expect(tx.callSession.findUnique).not.toHaveBeenCalled();
  });
  it.each(['stranger', 'other-astrologer'])('rejects IDOR %s', async actor => {
    await expect(service.access(actor, 'consultation', 'read')).rejects.toThrow('Access denied');
    expect(tx.userProfile.findUnique).not.toHaveBeenCalled();
  });
  it('does not load protected fields without consent', async () => {
    expect((await service.access('astrologer', 'consultation', 'read')).details).toBeNull();
    expect(tx.userProfile.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a mismatched persisted consent without repairing ownership', async () => {
    allow(); consent.customerId = 'other-customer';
    await expect(service.access('customer', 'consultation', 'grant', BIRTH_SHARING_NOTICE, consent.birthVersion, 'user:primary', 1)).rejects.toThrow('Consent participant mismatch');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.userProfile.findUnique).not.toHaveBeenCalled();
  });
  it.each(['chat', 'audio', 'video'])('shares %s only with assigned astrologer', async mode => {
    call.mode = mode; allow();
    expect((await service.access('astrologer', 'consultation', 'read')).details?.fullName).toBe('Synthetic Customer');
  });
  it.each(['PENDING', 'COMPLETED', 'CANCELLED'])('denies %s', async status => {
    call.status = status; allow();
    await expect(service.access('astrologer', 'consultation', 'read')).rejects.toThrow('Active consultation');
  });
  it('denies revoked consent', async () => { allow(); consent.revokedAt = new Date();
    expect((await service.access('astrologer', 'consultation', 'read')).details).toBeNull(); });
  it('denies expired consent', async () => { allow(); consent.expiresAt = new Date(0);
    expect((await service.access('astrologer', 'consultation', 'read')).details).toBeNull(); });
  it('denies consent that expires during profile loading', async () => {
    jest.useFakeTimers({now: new Date()});
    try {
      allow(); consent.expiresAt = new Date(Date.now() + 1000);
      tx.userProfile.findFirst.mockImplementation(async () => { jest.advanceTimersByTime(2000); return profile; });
      await expect(service.access('astrologer','consultation','read')).rejects.toThrow('Sharing permission expired');
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });
  it('profile edits require new consent', async () => { allow(); profile.timeOfBirth = '11:00';
    expect((await service.access('astrologer', 'consultation', 'read')).details).toBeNull(); });
  it('rejects grants against an unreviewed profile version', async () => {
    await expect(service.access('customer', 'consultation', 'grant', BIRTH_SHARING_NOTICE, 'stale', 'user:primary', 0)).rejects.toThrow('Review complete');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('customer preview and explicit grant produce one consent and one audit insert', async () => {
    const preview = await service.access('customer', 'consultation', 'read', undefined, undefined, 'user:primary');
    expect(preview.details?.fullName).toBe('Synthetic Customer');
    expect((await service.access('customer', 'consultation', 'grant', BIRTH_SHARING_NOTICE, preview.birthVersion, 'user:primary', 0)).state).toBe('SHARED');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('repeated same grant is idempotent', async () => { allow();
    await service.access('customer', 'consultation', 'grant', BIRTH_SHARING_NOTICE, consent.birthVersion, 'user:primary', 1);
    expect(tx.$executeRaw).not.toHaveBeenCalled(); });
  it('only customer can revoke', async () => { allow();
    await expect(service.access('astrologer', 'consultation', 'revoke')).rejects.toThrow('Only the customer');
    expect(tx.$executeRaw).not.toHaveBeenCalled(); });
  it('revocation clears the response and audits once', async () => { allow();
    expect((await service.access('customer', 'consultation', 'revoke')).details).toBeNull();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2); });
  it('missing time does not invent birth input', async () => { profile.timeOfBirth = null;
    expect((await service.access('customer', 'consultation', 'read', undefined, undefined, 'user:primary')).state).toBe('MISSING_DETAILS'); });
  it('suspension denies sharing', async () => { tx.astrologer.findUnique.mockResolvedValue({ isApproved: false });
    await expect(service.access('customer', 'consultation', 'read')).rejects.toThrow('Access denied'); });
  it('sanitizes raw database exceptions without retries', async () => { tx.$queryRaw.mockRejectedValue(new Error('sensitive synthetic diagnostic'));
    await expect(service.access('customer', 'consultation', 'read')).rejects.toThrow('Birth sharing temporarily unavailable');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1); });
});
