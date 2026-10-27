import { ValidationPipe } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FirebaseAdminGoogleLoginDto } from './dto/firebase-admin-google-login.dto';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(),
  initializeApp: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('Firebase Google Admin login (no provisioning)', () => {
  const envKeys = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'ADMIN_ALLOWED_FIREBASE_UID',
    'AUTH_CONTEXT_SESSION_KEY',
    'AUTH_CONTEXT_SESSION_KEY_FILE',
  ];
  let original: (string | undefined)[];
  let service: AuthService;
  let users: any;
  let verifyIdToken: jest.Mock;
  let getUser: jest.Mock;
  let admin: any;
  let token: any;
  let provider: any;
  const projectApp = { options: { projectId: 'admin-test-project' } };

  beforeEach(() => {
    jest.resetAllMocks();
    original = envKeys.map((key) => process.env[key]);
    process.env.ADMIN_ALLOWED_FIREBASE_UID = 'firebase-admin';
    process.env.AUTH_CONTEXT_SESSION_KEY='12'.repeat(32);
    delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
    process.env.FIREBASE_PROJECT_ID = 'admin-test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'fixture@example.invalid';
    process.env.FIREBASE_PRIVATE_KEY = 'mock-only';
    admin = {
      id: 'canonical-admin',
      supabaseId:'auth-canonical-admin',
      email: 'admin@example.invalid',
      isActive: true,
      isBlocked: false,
      role: { name: 'ADMIN' },
    };
    token = {
      uid: 'firebase-admin',
      exp:Math.floor(Date.now()/1000)+3600,
      aud: 'admin-test-project',
      email: admin.email,
      email_verified: true,
      firebase: {
        sign_in_provider: 'google.com',
        identities: { 'google.com': ['google-subject'] },
      },
    };
    provider = {
      disabled: false,
      emailVerified:true,
      email:admin.email,
      providerData: [
        { providerId: 'google.com', uid: 'google-subject', email: admin.email },
      ],
    };
    verifyIdToken = jest.fn().mockImplementation(async () => token);
    getUser = jest.fn().mockImplementation(async () => provider);
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken, getUser });
    (getApps as jest.Mock).mockReturnValue([
      { options: { projectId: 'foreign-project' } },
      projectApp,
    ]);
    // Fail if any method other than the read-only UID lookup is touched.
    users = new Proxy(
      {
        getAdminByFirebaseUid: jest.fn().mockImplementation(async () => admin),
        getUserByFirebaseUid: jest.fn().mockImplementation(async()=>admin),
      },
      {
        get(target, key) {
          if (key in target) return target[key as keyof typeof target];
          throw new Error('Unexpected UserService operation: ' + String(key));
        },
      },
    );
    service = new AuthService({} as any, users);
  });

  afterEach(() =>
    envKeys.forEach((key, i) => {
      if (original[i] === undefined) delete process.env[key];
      else process.env[key] = original[i];
    }),
  );

  it('returns only existing canonical Admin identity and reuses the project-specific app', async () => {
    const result = await service.loginAdminWithFirebaseGoogle('fixture-token');
    expect(result).toMatchObject({
      success: true,
      adminPolicy: 'single-google-v1',
      portal: 'admin',
      role: 'ADMIN',
      firebaseVerified: true,
      nextStep: 'OPEN_ADMIN_DASHBOARD',
      user: {
        id: 'canonical-admin',
        email: admin.email,
        role: 'ADMIN',
        portal: 'admin',
      },
    });
    expect(users.getAdminByFirebaseUid).toHaveBeenCalledWith('firebase-admin');
    expect(getAuth).toHaveBeenCalledWith(projectApp);
    expect(initializeApp).not.toHaveBeenCalled();
    expect(verifyIdToken).toHaveBeenCalledWith('fixture-token', true);
    expect(getUser).toHaveBeenCalledWith('firebase-admin');
  });

  it.each(['CUSTOMER', 'ASTROLOGER'])(
    'rejects existing %s role',
    async (role) => {
      admin.role.name = role;
      await expect(
        service.loginAdminWithFirebaseGoogle('fixture-token'),
      ).rejects.toThrow();
    },
  );
  it('linked Firebase password authenticates the same allowlisted UID into Admin context',async()=>{
    token.firebase.sign_in_provider='password';
    provider.providerData.push({providerId:'password',email:admin.email,uid:admin.email});
    await expect(service.loginAdminWithFirebaseEmail('fixture-password-source')).resolves.toMatchObject({
      role:'ADMIN',authContext:'admin',accessToken:expect.stringMatching(/^aspctx\./),user:{id:admin.id},
    });
  });
  it('Admin password cannot be invented from an unlinked provider',async()=>{
    token.firebase.sign_in_provider='password';
    await expect(service.loginAdminWithFirebaseEmail('fixture-password-source')).rejects.toThrow();
  });
  it.each([
    'blocked',
    'inactive',
    'unmapped',
    'email-conflict',
    'missing-role',
  ])('rejects %s without provisioning', async (reason) => {
    if (reason === 'blocked') admin.isBlocked = true;
    if (reason === 'inactive') admin.isActive = false;
    if (reason === 'unmapped') admin = null;
    if (reason === 'email-conflict') admin.email = 'foreign@example.invalid';
    if (reason === 'missing-role') admin.role = null;
    await expect(
      service.loginAdminWithFirebaseGoogle('fixture-token'),
    ).rejects.toThrow();
  });
  it.each(['revoked', 'expired', 'invalid-signature'])(
    'rejects %s token before canonical lookup',
    async (reason) => {
      verifyIdToken.mockRejectedValue(new Error(reason));
      await expect(
        service.loginAdminWithFirebaseGoogle('fixture-token'),
      ).rejects.toThrow();
      expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
    },
  );
  it.each([
    'wrong-project',
    'unverified-email',
    'wrong-provider',
    'missing-google',
    'disabled',
    'provider-email-conflict',
    'subject-conflict',
    'missing-subject',
  ])('rejects %s Firebase proof before canonical lookup', async (reason) => {
    if (reason === 'wrong-project') token.aud = 'foreign-project';
    if (reason === 'unverified-email') token.email_verified = false;
    if (reason === 'wrong-provider')
      token.firebase.sign_in_provider = 'password';
    if (reason === 'missing-google') provider.providerData = [];
    if (reason === 'disabled') provider.disabled = true;
    if (reason === 'provider-email-conflict')
      provider.providerData[0].email = 'foreign@example.invalid';
    if (reason === 'subject-conflict')
      token.firebase.identities['google.com'] = ['foreign-subject'];
    if (reason === 'missing-subject') token.firebase.identities = {};
    await expect(
      service.loginAdminWithFirebaseGoogle('fixture-token'),
    ).rejects.toThrow();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it('rejects missing credentials and empty tokens without canonical lookup', async () => {
    await expect(service.loginAdminWithFirebaseGoogle(' ')).rejects.toThrow();
    delete process.env.FIREBASE_PROJECT_ID;
    await expect(
      service.loginAdminWithFirebaseGoogle('fixture-token'),
    ).rejects.toThrow();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it('routes the dedicated Admin endpoint to the lookup-only service', async () => {
    const controller = new AuthController(service, {} as any);
    expect(
      Reflect.getMetadata('path', controller.firebaseAdminGoogleLogin),
    ).toBe('admin/firebase/google');
    await expect(
      controller.firebaseAdminGoogleLogin({ idToken: 'fixture-token' }),
    ).resolves.toMatchObject({ role: 'ADMIN' });
  });
  it.each([
    {},
    { idToken: '' },
    { idToken: 5 },
    { idToken: 'fixture-token', role: 'ADMIN' },
    { idToken: 'fixture-token', portal: 'admin' },
  ])(
    'rejects invalid or client-selected privilege payload %j',
    async (payload) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      await expect(
        pipe.transform(payload, {
          type: 'body',
          metatype: FirebaseAdminGoogleLoginDto,
        }),
      ).rejects.toThrow();
    },
  );
  it('missing allowlist fails before Firebase or canonical lookup', async () => {
    delete process.env.ADMIN_ALLOWED_FIREBASE_UID;
    await expect(
      service.loginAdminWithFirebaseGoogle('fixture-token'),
    ).rejects.toThrow();
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it.each(['send', 'verify', 'phone', 'refresh'])(
    'legacy Admin %s is blocked before side effects',
    async (operation) => {
      const call =
        operation === 'send'
          ? service.sendAdminOtp('fixture-phone')
          : operation === 'verify'
            ? service.verifyAdminOtp('fixture-phone', 'fixture-code')
            : operation === 'phone'
              ? service.verifyFirebasePhoneToken('fixture-token', 'admin')
              : service.refreshSession('fixture-refresh', 'admin');
      await expect(call).rejects.toThrow('requires');
      expect(verifyIdToken).not.toHaveBeenCalled();
      expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
    },
  );
});
