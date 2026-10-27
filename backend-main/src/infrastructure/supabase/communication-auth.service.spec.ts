jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  decodeProtectedHeader: jest.fn(() => ({ alg: 'HS256' })),
  jwtVerify: jest.fn(),
}));
jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(),
  initializeApp: jest.fn(),
  cert: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { jwtVerify } from 'jose';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { SupabaseJwtService } from './supabase-jwt.service';
import { CommunicationAuthService } from './communication-auth.service';

describe('shared communication authentication (mock providers/database)', () => {
  let prisma: any,
    service: CommunicationAuthService,
    verifyIdToken: jest.Mock,
    providerGetUser: jest.Mock;
  const user = {
    id: 'canonical',
    supabaseId: 'canonical-subject',
    isActive: true,
    isBlocked: false,
    role: { name: 'customer' },
  };
  const prior = process.env.FIREBASE_PROJECT_ID;
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'fixture-project';
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([user]),
        create: jest.fn(),
        update: jest.fn(),
      },
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({ user }),
        create: jest.fn(),
      },
    };
    const config: any = {
      getOrThrow: () => 'https://fixture.supabase.invalid',
      get: (k: string) =>
        k === 'supabase.jwtSecret'
          ? 'fixture-secret'
          : k === 'NODE_ENV'
            ? 'production'
            : undefined,
    };
    verifyIdToken = jest
      .fn()
      .mockResolvedValue({
        uid: 'fixture-firebase',
        aud: 'fixture-project',
        exp: Math.floor(Date.now() / 1000) + 300,
      });
    (getApps as jest.Mock).mockReturnValue([
      { options: { projectId: 'foreign' } },
      { options: { projectId: 'fixture-project' } },
    ]);
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    (jwtVerify as jest.Mock).mockRejectedValue(new Error('not Supabase'));
    providerGetUser = jest
      .fn()
      .mockResolvedValue({
        data: { user: { id: 'legacy-subject' } },
        error: null,
      });
    service = new CommunicationAuthService(
      new SupabaseJwtService(config, prisma),
      prisma,
      { getClient: () => ({ auth: { getUser: providerGetUser } }) } as any,
      config,
    );
  });
  afterAll(() => {
    if (prior === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = prior;
  });
  it('maps revoked-checked Firebase token to existing canonical active role without provisioning', async () => {
    const result = await service.verify('fixture-token');
    expect(result).toMatchObject({
      sub: 'canonical-subject',
      asp_user_id: 'canonical',
      asp_account_role: 'customer',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('fixture-token', true);
    expect((getAuth as jest.Mock).mock.calls[0][0].options.projectId).toBe(
      'fixture-project',
    );
    expect(providerGetUser).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.userAuthIdentity.create).not.toHaveBeenCalled();
  });
  it('preserves legacy Supabase tokens and checks provider account validity', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'legacy-subject',
        role: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 300,
      },
    });
    expect(await service.verify('legacy')).toMatchObject({
      asp_user_id: 'canonical',
    });
    expect(providerGetUser).toHaveBeenCalledWith('legacy');
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
  it.each([
    'auth/id-token-revoked',
    'auth/id-token-expired',
    'auth/invalid-id-token',
  ])('rejects %s', async (code) => {
    verifyIdToken.mockRejectedValue({ code });
    await expect(service.verify('invalid')).rejects.toThrow(
      'Communication authentication required',
    );
  });
  it('rejects foreign Firebase project', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'x',
      aud: 'foreign',
      exp: 9999999999,
    });
    await expect(service.verify('invalid')).rejects.toThrow();
  });
  it('rejects unmapped Firebase identity', async () => {
    prisma.userAuthIdentity.findUnique.mockResolvedValue(null);
    await expect(service.verify('invalid')).rejects.toThrow();
  });
  it.each([{ isActive: false }, { isBlocked: true }, { role: null }])(
    'rejects unavailable canonical account %j',
    async (change) => {
      prisma.user.findMany.mockResolvedValue([{ ...user, ...change }]);
      await expect(service.verify('token')).rejects.toThrow();
    },
  );
  it('rejects ambiguous canonical resolution', async () => {
    prisma.user.findMany.mockResolvedValue([user, user]);
    await expect(service.verify('token')).rejects.toThrow();
  });
  it('rejects an expired verified payload as defense in depth', async () => {
    verifyIdToken.mockResolvedValue({
      uid: 'x',
      aud: 'fixture-project',
      exp: 1,
    });
    await expect(service.verify('token')).rejects.toThrow();
  });
  it('fails closed on provider revocation/account check failure for legacy token', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        sub: 'legacy-subject',
        role: 'authenticated',
        exp: 9999999999,
      },
    });
    providerGetUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'revoked' },
    });
    await expect(service.verify('legacy')).rejects.toThrow();
  });
});
