jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: jest.fn(() => []), initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('Verified Google recovery orchestration', () => {
  let users: any, service: AuthService;
  const canonical: any = { id: 'original', supabaseId: 'original-auth', email: 'owner@example.invalid',
    role: { name: 'CUSTOMER' }, isActive: true, isBlocked: false, isProfileComplete: true,
    freeChatGrantedAt: null, freeChatUsedAt: null };
  beforeEach(() => {
    users = { syncFirebaseEmailUser: jest.fn().mockResolvedValue({ user: canonical, isNewUser: false }),
      recoverLegacyFirebaseGoogleIdentity: jest.fn().mockResolvedValue(false) };
    service = new AuthService({} as any, users);
    jest.spyOn(service as any, 'verifyFirebaseGoogleIdToken').mockResolvedValue({ uid: 'verified-uid',
      email: canonical.email, googleSubject: 'verified-google-subject' });
  });
  it('existing mapped Google customer enters customer portal directly', async () => {
    const result = await service.loginWithFirebaseGoogle('verified-token');
    expect(result.user.id).toBe('original'); expect(result.role).toBe('CUSTOMER');
    expect(users.recoverLegacyFirebaseGoogleIdentity).not.toHaveBeenCalled();
  });
  it('recovers actual legacy Google ownership once, then reuses its mapping', async () => {
    users.syncFirebaseEmailUser.mockRejectedValueOnce(new ConflictException({ code: 'FIREBASE_GOOGLE_LINK_REQUIRED' }));
    users.recoverLegacyFirebaseGoogleIdentity.mockResolvedValue(true);
    expect((await service.loginWithFirebaseGoogle('verified-token')).user.id).toBe('original');
    expect((await service.loginWithFirebaseGoogle('verified-token')).user.id).toBe('original');
    expect(users.recoverLegacyFirebaseGoogleIdentity).toHaveBeenCalledTimes(1);
    expect(users.recoverLegacyFirebaseGoogleIdentity).toHaveBeenCalledWith('verified-uid', canonical.email, 'verified-google-subject');
  });
  it('generic email collision stays blocked without legacy proof', async () => {
    users.syncFirebaseEmailUser.mockRejectedValue(new ConflictException({ code: 'FIREBASE_GOOGLE_LINK_REQUIRED' }));
    await expect(service.loginWithFirebaseGoogle('verified-token')).rejects.toMatchObject({ response: { code: 'FIREBASE_GOOGLE_LINK_REQUIRED' } });
    expect(users.syncFirebaseEmailUser).toHaveBeenCalledTimes(1);
  });
  it('invalid Firebase identity cannot start any recovery or user sync', async () => {
    (service as any).verifyFirebaseGoogleIdToken.mockRejectedValue(new Error('invalid ownership'));
    await expect(service.loginWithFirebaseGoogle('invalid-token')).rejects.toThrow();
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();
    expect(users.recoverLegacyFirebaseGoogleIdentity).not.toHaveBeenCalled();
  });
});
