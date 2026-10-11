import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { UserService } from '../user/user.service';
import { getAuth } from 'firebase-admin/auth';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: {} },
        { provide: UserService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects an expired or revoked Firebase email token', async () => {
    const previousProjectId = process.env.FIREBASE_PROJECT_ID;
    const previousClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const previousPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const verifyIdToken = jest
      .fn()
      .mockRejectedValue(new Error('Firebase ID token has expired'));

    process.env.FIREBASE_PROJECT_ID = 'auth-test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'auth-test@example.invalid';
    process.env.FIREBASE_PRIVATE_KEY = 'test-only-private-key';
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });

    try {
      await expect(
        service.verifyFirebaseEmailToken('expired-test-token'),
      ).rejects.toMatchObject({
        response: { code: 'FIREBASE_EMAIL_TOKEN_INVALID' },
      });

      expect(verifyIdToken).toHaveBeenCalledWith('expired-test-token', true);
    } finally {
      if (previousProjectId === undefined) {
        delete process.env.FIREBASE_PROJECT_ID;
      } else {
        process.env.FIREBASE_PROJECT_ID = previousProjectId;
      }
      if (previousClientEmail === undefined) {
        delete process.env.FIREBASE_CLIENT_EMAIL;
      } else {
        process.env.FIREBASE_CLIENT_EMAIL = previousClientEmail;
      }
      if (previousPrivateKey === undefined) {
        delete process.env.FIREBASE_PRIVATE_KEY;
      } else {
        process.env.FIREBASE_PRIVATE_KEY = previousPrivateKey;
      }
    }
  });

  it('confirms Google linking on the same Firebase UID and preserves the canonical backend user', async () => {
    const canonicalUser = {
      id: 'canonical-email-customer-id',
      supabaseId: 'firebase:existing-email-uid',
      phone: null,
      email: 'customer@example.invalid',
      role: { name: 'CUSTOMER' },
      isNewUser: false,
      isProfileComplete: true,
      subscriptionPlan: { name: 'PAID' },
      subscriptionStatus: 'ACTIVE',
      freeChatGrantedAt: null,
      freeChatUsedAt: null,
      freeChatMinutes: 0,
      isAstrologer: false,
      isActive: true,
      isBlocked: false,
    };
    const syncFirebaseEmailUser = jest.fn().mockResolvedValue({
      user: canonicalUser,
      isNewUser: false,
    });
    (service as any).userService.syncFirebaseEmailUser = syncFirebaseEmailUser;
    jest
      .spyOn(service as any, 'verifyFirebaseGoogleIdToken')
      .mockResolvedValue({
        uid: 'existing-email-uid',
        email: 'customer@example.invalid',
        googleSubject: 'google-subject-verified-by-firebase',
        hasEmailPasswordProvider: true,
      });

    const result = await service.linkFirebaseGoogleToEmailAccount(
      'fresh-firebase-token',
      true,
    );

    expect(syncFirebaseEmailUser).toHaveBeenCalledWith({
      firebaseUid: 'existing-email-uid',
      email: 'customer@example.invalid',
      identityType: 'google',
    });
    expect(result.user.id).toBe('canonical-email-customer-id');
    expect(result.user.subscriptionStatus).toBe('ACTIVE');
  });

  it('requires explicit consent before Firebase Email/Password-to-Google linking', async () => {
    const verifySpy = jest.spyOn(service as any, 'verifyFirebaseGoogleIdToken');

    await expect(
      service.linkFirebaseGoogleToEmailAccount('firebase-token', false),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_LINK_CONFIRMATION_REQUIRED' },
    });

    expect(verifySpy).not.toHaveBeenCalled();
  });

  it('rejects Google linking when the verified Firebase account lacks email/password ownership', async () => {
    const syncFirebaseEmailUser = jest.fn();
    (service as any).userService.syncFirebaseEmailUser = syncFirebaseEmailUser;
    jest
      .spyOn(service as any, 'verifyFirebaseGoogleIdToken')
      .mockResolvedValue({
        uid: 'google-only-uid',
        email: 'customer@example.invalid',
        googleSubject: 'google-subject-verified-by-firebase',
        hasEmailPasswordProvider: false,
      });

    await expect(
      service.linkFirebaseGoogleToEmailAccount('google-only-token', true),
    ).rejects.toMatchObject({
      response: { code: 'FIREBASE_EMAIL_GOOGLE_LINK_NOT_AVAILABLE' },
    });
    expect(syncFirebaseEmailUser).not.toHaveBeenCalled();
  });

  it('rejects a revoked Firebase Google token before linking', async () => {
    const previousProjectId = process.env.FIREBASE_PROJECT_ID;
    const previousClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const previousPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    const verifyIdToken = jest
      .fn()
      .mockRejectedValue(new Error('Firebase ID token has been revoked'));

    process.env.FIREBASE_PROJECT_ID = 'auth-test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'auth-test@example.invalid';
    process.env.FIREBASE_PRIVATE_KEY = 'test-only-private-key';
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });

    try {
      await expect(
        (service as any).verifyFirebaseGoogleIdToken('revoked-google-token'),
      ).rejects.toMatchObject({
        response: { code: 'FIREBASE_GOOGLE_TOKEN_INVALID' },
      });
      expect(verifyIdToken).toHaveBeenCalledWith('revoked-google-token', true);
    } finally {
      if (previousProjectId === undefined) {
        delete process.env.FIREBASE_PROJECT_ID;
      } else {
        process.env.FIREBASE_PROJECT_ID = previousProjectId;
      }
      if (previousClientEmail === undefined) {
        delete process.env.FIREBASE_CLIENT_EMAIL;
      } else {
        process.env.FIREBASE_CLIENT_EMAIL = previousClientEmail;
      }
      if (previousPrivateKey === undefined) {
        delete process.env.FIREBASE_PRIVATE_KEY;
      } else {
        process.env.FIREBASE_PRIVATE_KEY = previousPrivateKey;
      }
    }
  });
});
