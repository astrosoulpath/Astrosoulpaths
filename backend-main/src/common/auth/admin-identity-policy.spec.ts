import { establishContextSession } from './context-session';
import { UserService } from '../../module/user/user.service';
jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({
  SupabaseJwtService: jest.fn(),
}));
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
import { Reflector } from '@nestjs/core';
import { verifyFirebaseGoogleIdentity } from './firebase-google-identity';
import {
  authorizeAdminIdentity,
  bindAdminRequest,
  readAllowedAdminUid,
  requireAdminRequest,
  createAdminHttpMiddleware,
} from './admin-identity-policy';
import { SupabaseAuthGuard } from '../guards/supabase-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

jest.mock('./firebase-google-identity', () => ({
  verifyFirebaseGoogleIdentity: jest.fn(),
}));

describe('single Google Admin policy and guards', () => {
  let prior: string | undefined;
  const priorKey=process.env.AUTH_CONTEXT_SESSION_KEY;
  const priorFile=process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
  const identity: any = {
    uid: 'fixture-admin',
    email: 'fixture@example.invalid',
    googleEmail: 'fixture@example.invalid',
    googleSubject: 'subject',
    tokenGoogleSubjects: ['subject'],
    firebaseUserDisabled: false,
  };
  let users: any, user: any;
  beforeEach(() => {
    delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;
    prior = process.env.ADMIN_ALLOWED_FIREBASE_UID;
    process.env.ADMIN_ALLOWED_FIREBASE_UID = 'fixture-admin';
    process.env.AUTH_CONTEXT_SESSION_KEY='12'.repeat(32);
    identity.expiresAt=Math.floor(Date.now()/1000)+3600;
    user = {
      id: 'canonical',
      supabaseId: 'firebase:fixture-admin',
      email: identity.email,
      role: { name: 'admin' },
      isActive: true,
      isBlocked: false,
    };
    users = {
      getAdminByFirebaseUid: jest.fn().mockImplementation(async () => user),
      syncFirebaseEmailUser: jest.fn(),
      syncFirebasePhoneUser: jest.fn(),
    };
    (verifyFirebaseGoogleIdentity as jest.Mock)
      .mockReset()
      .mockResolvedValue(identity);
  });
  async function credential(){return (await establishContextSession('synthetic-source','admin',{...users,getUserByFirebaseUid:()=>Promise.resolve(user)})).accessToken;}
  afterEach(() => {
    if(priorFile===undefined)delete process.env.AUTH_CONTEXT_SESSION_KEY_FILE;else process.env.AUTH_CONTEXT_SESSION_KEY_FILE=priorFile;
    if(priorKey===undefined)delete process.env.AUTH_CONTEXT_SESSION_KEY;else process.env.AUTH_CONTEXT_SESSION_KEY=priorKey;
    if (prior === undefined) delete process.env.ADMIN_ALLOWED_FIREBASE_UID;
    else process.env.ADMIN_ALLOWED_FIREBASE_UID = prior;
  });
  it.each([
    undefined,
    '',
    ' ',
    'one,two',
    '["one"]',
    'one\ntwo',
    'x'.repeat(129),
  ])('fails closed for missing/list/invalid configuration', (value) => {
    expect(() =>
      readAllowedAdminUid({ ADMIN_ALLOWED_FIREBASE_UID: value }),
    ).toThrow();
  });
  it('accepts exactly one opaque UID without exposing it', () => {
    expect(readAllowedAdminUid()).toBe('fixture-admin');
  });
  it('rejects another UID before any canonical read even when it might be Admin', async () => {
    await expect(
      authorizeAdminIdentity({ ...identity, uid: 'other-admin' }, users),
    ).rejects.toThrow();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it.each(['CUSTOMER', 'ASTROLOGER'])('rejects %s', async (role) => {
    user.role.name = role;
    await expect(authorizeAdminIdentity(identity, users)).rejects.toThrow();
  });
  it.each(['blocked', 'inactive', 'missing', 'email-conflict'])(
    'rejects canonical %s',
    async (reason) => {
      if (reason === 'blocked') user.isBlocked = true;
      if (reason === 'inactive') user.isActive = false;
      if (reason === 'missing') user = null;
      if (reason === 'email-conflict') user.email = 'foreign@example.invalid';
      await expect(authorizeAdminIdentity(identity, users)).rejects.toThrow();
    },
  );
  it('requires unforgeable per-request proof, not request.user claims', () => {
    expect(() =>
      requireAdminRequest({
        user: { sub: user.supabaseId, firebaseUid: identity.uid },
      } as any),
    ).toThrow();
  });
  it('binds canonical ID and rejects copied proof on a new request', async () => {
    const request: any = {};
    await bindAdminRequest(request, await credential(), users);
    expect(requireAdminRequest(request).id).toBe('canonical');
    expect(() => requireAdminRequest({ ...request })).toThrow();
    process.env.ADMIN_ALLOWED_FIREBASE_UID = 'different';
    expect(() => requireAdminRequest(request)).toThrow();
  });
  function context(request: any, roles: string[] = ['admin']) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ROLES_KEY ? roles : false,
      ),
    } as unknown as Reflector;
    const ctx: any = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return { reflector, ctx };
  }
  it('Admin-only requests skip Supabase/local tokens and mutable synchronization', async () => {
    const request: any = { headers: { authorization: 'Bearer '+await credential() } },
      { reflector, ctx } = context(request);
    const supabase: any = { verifyAccessToken: jest.fn() };
    const guard = new SupabaseAuthGuard(reflector, supabase, users);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(supabase.verifyAccessToken).not.toHaveBeenCalled();
    expect(users.syncFirebaseEmailUser).not.toHaveBeenCalled();
    expect(users.syncFirebasePhoneUser).not.toHaveBeenCalled();
    expect(await new RolesGuard(reflector, {} as any).canActivate(ctx)).toBe(
      true,
    );
  });
  it('rejects a revoked/non-Google/legacy bearer without falling back', async () => {
    (verifyFirebaseGoogleIdentity as jest.Mock).mockRejectedValue(
      new Error('invalid proof'),
    );
    const request: any = { headers: { authorization: 'Bearer legacy-token' } },
      { reflector, ctx } = context(request);
    const supabase: any = { verifyAccessToken: jest.fn() };
    await expect(
      new SupabaseAuthGuard(reflector, supabase, users).canActivate(ctx),
    ).rejects.toThrow();
    expect(supabase.verifyAccessToken).not.toHaveBeenCalled();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it('missing bearer is rejected before canonical reads', async () => {
    const { reflector, ctx } = context({ headers: {} });
    await expect(
      new SupabaseAuthGuard(reflector, {} as any, users).canActivate(ctx),
    ).rejects.toThrow();
    expect(users.getAdminByFirebaseUid).not.toHaveBeenCalled();
  });
  it('Customer routes retain existing Supabase authentication without UID configuration', async () => {
    delete process.env.ADMIN_ALLOWED_FIREBASE_UID;
    const request: any = {
        headers: { authorization: 'Bearer customer-token' },
      },
      { reflector, ctx } = context(request, ['customer']);
    const customerUsers: any = { assertActiveAccount: jest.fn() };
    const guard = new SupabaseAuthGuard(
      reflector,
      {
        verifyAccessToken: jest.fn().mockResolvedValue({ sub: 'customer' }),
      } as any,
      customerUsers,
    );
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(request.user.sub).toBe('customer');
    expect(verifyFirebaseGoogleIdentity).not.toHaveBeenCalled();
  });
  it('raw Admin queue middleware refuses Basic Auth and missing Google bearer', async () => {
    const response: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      },
      next = jest.fn();
    await createAdminHttpMiddleware(users)(
      { headers: { authorization: 'Basic fixture' } } as any,
      response,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it('raw Admin queue middleware permits only verified sole Google Admin', async () => {
    const response: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      },
      next = jest.fn();
    await createAdminHttpMiddleware(users)(
      { headers: { authorization: 'Bearer '+await credential() } } as any,
      response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
  it('raw Admin queue middleware rejects foreign Admin UID', async () => {
    (verifyFirebaseGoogleIdentity as jest.Mock).mockResolvedValue({
      ...identity,
      uid: 'foreign',
    });
    const response: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      },
      next = jest.fn();
    await createAdminHttpMiddleware(users)(
      { headers: { authorization: 'Bearer other' } } as any,
      response,
      next,
    );
    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['missing', 'wrong-type', 'foreign-email'])(
    'Admin lookup rejects %s identity without writes',
    async (reason) => {
      const mapping: any =
        reason === 'missing'
          ? null
          : {
              identityType: reason === 'wrong-type' ? 'phone' : 'google',
              email:
                reason === 'foreign-email'
                  ? 'foreign@example.invalid'
                  : identity.email,
              user,
            };
      const prisma: any = {
        userAuthIdentity: { findUnique: jest.fn().mockResolvedValue(mapping) },
      };
      expect(
        await UserService.prototype.getAdminByFirebaseUid.call(
          { prisma } as any,
          identity.uid,
        ),
      ).toBeNull();
      expect(prisma.userAuthIdentity.findUnique).toHaveBeenCalledTimes(1);
    },
  );
  it('Admin lookup uses exact provider/UID mapping and preserves canonical record', async () => {
    const prisma: any = {
      userAuthIdentity: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            identityType: 'google',
            email: identity.email,
            user,
          }),
      },
    };
    expect(
      await UserService.prototype.getAdminByFirebaseUid.call(
        { prisma } as any,
        identity.uid,
      ),
    ).toBe(user);
    expect(prisma.userAuthIdentity.findUnique.mock.calls[0][0].where).toEqual({
      provider_providerUserId: {
        provider: 'firebase',
        providerUserId: identity.uid,
      },
    });
  });
});
