jest.mock('../../common/auth/firebase-google-identity',()=>({verifyFirebaseGoogleIdentity:jest.fn()}));
import { verifyFirebaseGoogleIdentity } from '../../common/auth/firebase-google-identity';
jest.mock('firebase-admin/app', () => ({ cert: jest.fn(), getApps: jest.fn(() => []), initializeApp: jest.fn() }));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('Verified Google recovery orchestration', () => {
  let users: any, service: AuthService;
  const priorKey=process.env.AUTH_CONTEXT_SESSION_KEY;
  const priorFile=process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
  afterEach(()=>{if(priorFile===undefined)delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;else process.env.AUTH_CONTEXT_SESSION_KEY_FILE=priorFile;if(priorKey===undefined)delete process.env.AUTH_CONTEXT_SESSION_KEY;else process.env.AUTH_CONTEXT_SESSION_KEY=priorKey;});
  const canonical: any = { id: 'original', supabaseId: 'original-auth', email: 'owner@example.invalid',
    role: { name: 'CUSTOMER' }, isActive: true, isBlocked: false, isProfileComplete: true,
    freeChatGrantedAt: null, freeChatUsedAt: null };
  beforeEach(() => {
    delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
    process.env.AUTH_CONTEXT_SESSION_KEY='12'.repeat(32);
    users = { getUserByFirebaseUid: jest.fn().mockResolvedValue(canonical),
      syncFirebaseEmailUser: jest.fn().mockResolvedValue({ user: canonical, isNewUser: false }),
      recoverLegacyFirebaseGoogleIdentity: jest.fn().mockResolvedValue(false) };
    service = new AuthService({} as any, users);
    (verifyFirebaseGoogleIdentity as jest.Mock).mockReset().mockResolvedValue({uid:'verified-uid',email:canonical.email,googleEmail:canonical.email,googleSubject:'verified-google-subject',tokenGoogleSubjects:['verified-google-subject'],signInProvider:'google.com',expiresAt:Math.floor(Date.now()/1000)+3600});
  });
  it('existing mapped Google customer enters customer portal directly', async () => {
    const result = await service.loginWithFirebaseGoogle('verified-token');
    expect(result.user.id).toBe('original'); expect(result.role).toBe('CUSTOMER');
    expect(users.recoverLegacyFirebaseGoogleIdentity).not.toHaveBeenCalled();
  });
  it('canonical Admin receives only Customer context without synchronization or recovery', async () => {
    users.getUserByFirebaseUid.mockResolvedValue({ ...canonical, role: { name: ' admin ' } });
    await expect(service.loginWithFirebaseGoogle('verified-token')).resolves.toMatchObject({authContext:'customer',role:'CUSTOMER'});
    expect(users.getUserByFirebaseUid).toHaveBeenCalledWith('verified-uid');
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();
    expect(users.recoverLegacyFirebaseGoogleIdentity).not.toHaveBeenCalled();
  });
  it('preserves existing USER customer eligibility and canonical identity', async () => {
    users.getUserByFirebaseUid.mockResolvedValue({ ...canonical, role: { name: 'USER' } });
    const result = await service.loginWithFirebaseGoogle('verified-token');
    expect(result.user.accountRole).toBe('USER');
    expect(result.user.id).toBe(canonical.id);
    expect(result.portal).toBe('customer');
  });
  it('recovers actual legacy Google ownership once, then reuses its mapping', async () => {
    users.getUserByFirebaseUid.mockResolvedValueOnce(null);
    users.syncFirebaseEmailUser.mockRejectedValueOnce(new ConflictException({ code: 'FIREBASE_GOOGLE_LINK_REQUIRED' }));
    users.recoverLegacyFirebaseGoogleIdentity.mockResolvedValue(true);
    expect((await service.loginWithFirebaseGoogle('verified-token')).user.id).toBe('original');
    expect((await service.loginWithFirebaseGoogle('verified-token')).user.id).toBe('original');
    expect(users.recoverLegacyFirebaseGoogleIdentity).toHaveBeenCalledTimes(1);
    expect(users.recoverLegacyFirebaseGoogleIdentity).toHaveBeenCalledWith('verified-uid', canonical.email, 'verified-google-subject');
  });
  it('generic email collision stays blocked without legacy proof', async () => {
    users.getUserByFirebaseUid.mockResolvedValue(null);
    users.syncFirebaseEmailUser.mockRejectedValue(new ConflictException({ code: 'FIREBASE_GOOGLE_LINK_REQUIRED' }));
    await expect(service.loginWithFirebaseGoogle('verified-token')).rejects.toMatchObject({ response: { code: 'FIREBASE_GOOGLE_LINK_REQUIRED' } });
    expect(users.syncFirebaseEmailUser).toHaveBeenCalledTimes(1);
  });
  it('invalid Firebase identity cannot start any recovery or user sync', async () => {
    (verifyFirebaseGoogleIdentity as jest.Mock).mockRejectedValue(new Error('invalid ownership'));
    await expect(service.loginWithFirebaseGoogle('invalid-token')).rejects.toThrow();
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();
    expect(users.recoverLegacyFirebaseGoogleIdentity).not.toHaveBeenCalled();
    expect(users.getUserByFirebaseUid).not.toHaveBeenCalled();
  });
});
