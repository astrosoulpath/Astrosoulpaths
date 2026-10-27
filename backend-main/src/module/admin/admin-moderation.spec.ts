import { AdminModerationService } from './admin-moderation.service';
import {
  moderationInput,
  moderationTransition,
} from './admin-moderation.policy';
import * as policy from '../../common/auth/admin-identity-policy';
import { AdminController } from './admin.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
// Keep these in-memory RBAC/transaction tests isolated from the live SDK.
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), decodeProtectedHeader: jest.fn(), jwtVerify: jest.fn() }));
const command = (n = 1, action = 'BLOCK', expectedVersion = 0) => ({
  requestId: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'),
  action,
  expectedVersion,
  reason: 'Synthetic operator review',
});
function fixture(astro = false) {
  const memory = {
    user: {
      id: 'target',
      isActive: true,
      isBlocked: false,
      isAstrologer: astro,
      role: { name: astro ? 'ASTROLOGER' : 'CUSTOMER' },
      astrologer: astro ? { id: 'profile' } : null,
    },
    profile: astro
      ? {
          id: 'profile',
          userId: 'target',
          documents: {
            identityProof: {
              type: 'identity',
              name: 'synthetic.pdf',
              url: 'target/identity/synthetic.pdf',
            },
          },
          isVerified: false,
          isApproved: false,
          isOnline: false,
        }
      : null,
    subject: null as { state: string; version: number } | null,
    audits: [] as Record<string, unknown>[],
  };
  const flags = {
    calls: 0,
    payments: 0,
    payouts: 0,
    locked: 0,
    auditFails: false,
    actorActive: true,
    wrongUid: false,
  };
  let writes = 0;
  const transaction = jest.fn(async (callback, _options?: unknown) => {
    const draft = structuredClone(memory);
    const tx = {
      user: {
        findUnique: jest.fn(async ({ where }) =>
          where.id === 'actor'
            ? {
                id: 'actor',
                isActive: flags.actorActive,
                isBlocked: false,
                role: { name: 'ADMIN' },
              }
            : draft.user,
        ),
        update: jest.fn(async ({ data }) => {
          writes++;
          Object.assign(draft.user, data);
          return draft.user;
        }),
      },
      astrologer: {
        findUnique: jest.fn(async () => draft.profile),
        update: jest.fn(async ({ data }) => {
          writes++;
          Object.assign(draft.profile!, data);
          return draft.profile;
        }),
      },
      userAuthIdentity: {
        findUnique: jest.fn(async () => ({
          userId: flags.wrongUid ? 'other' : 'actor',
        })),
      },
      callSession: { count: jest.fn(async () => flags.calls) },
      paymentOrder: { count: jest.fn(async () => flags.payments) },
      wallet: {
        findUnique: jest.fn(async () => ({ lockedBalance: flags.locked })),
      },
      astrologerPayout: { count: jest.fn(async () => flags.payouts) },
      $queryRaw: jest.fn(async (strings, ...values) => {
        const sql = strings.join('?');
        if (sql.includes('FROM "AdminModerationAudit"'))
          return draft.audits.filter((a) => a.requestId === values[0]);
        if (sql.includes('FROM "AdminModerationSubject"'))
          return draft.subject ? [draft.subject] : [];
        return [{ id: 'actor' }, { id: 'target' }];
      }),
      $executeRaw: jest.fn(async (strings, ...values) => {
        const sql = strings.join('?');
        if (sql.includes('AdminModerationAudit')) {
          if (flags.auditFails) throw Error('private backend details');
          draft.audits.push(
            Object.fromEntries(
              [
                'requestId',
                'actorId',
                'userId',
                'kind',
                'action',
                'reason',
                'previousState',
                'nextState',
                'version',
              ].map((k, i) => [k, values[i]]),
            ),
          );
        } else {
          draft.subject = {
            state: sql.startsWith('UPDATE') ? values[0] : values[2],
            version: sql.startsWith('UPDATE') ? values[1] : 1,
          };
        }
        return 1;
      }),
    };
    const result = await callback(tx);
    Object.assign(memory, draft);
    return result;
  });
  return {
    service: new AdminModerationService({ $transaction: transaction } as never),
    memory,
    flags,
    transaction,
    get writes() {
      return writes;
    },
  };
}
describe('Audited moderation remains bounded and default-off', () => {
  const old = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_MODERATION_WRITES_ENABLED = 'true';
    process.env.ADMIN_MODERATION_SCHEMA_REVIEWED = 'true';
    process.env.ADMIN_ALLOWED_FIREBASE_UID = 'synthetic-fixture';
    jest
      .spyOn(policy, 'requireAdminRequest')
      .mockReturnValue({ id: 'actor' } as never);
  });
  afterEach(() => {
    process.env = old;
    jest.restoreAllMocks();
  });
  it('default-off performs no transaction or table reads', async () => {
    delete process.env.ADMIN_MODERATION_WRITES_ENABLED;
    const f = fixture();
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).rejects.toThrow('not activated');
    expect(await f.service.snapshot({}, 'CUSTOMER', 'target')).toEqual({
      success: true,
      available: false,
    });
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('rejects forged role/context objects before database access', async () => {
    jest.restoreAllMocks();
    const f = fixture();
    await expect(
      f.service.execute(
        { user: { sub: 'forged' } },
        'CUSTOMER',
        'target',
        command(),
      ),
    ).rejects.toThrow('Verified Firebase Admin context');
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('preserves both canonical Admin guards on the new controller', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminModerationController),
    ).toEqual([SupabaseAuthGuard, RolesGuard]);
  });
  it('atomically blocks with an actor-bound durable audit and no role/wallet changes', async () => {
    const f = fixture();
    expect(
      await f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).toMatchObject({ success: true, state: 'BLOCKED', version: 1 });
    expect(f.memory.user.isBlocked).toBe(true);
    expect(f.memory.user.role.name).toBe('CUSTOMER');
    expect(f.memory.audits[0]).toMatchObject({
      actorId: 'actor',
      previousState: 'ACTIVE',
      nextState: 'BLOCKED',
      version: 1,
    });
    expect(f.transaction.mock.calls[0][1]).toMatchObject({
      isolationLevel: 'Serializable',
    });
  });
  it('idempotently replays the same command without another update/audit', async () => {
    const f = fixture();
    await f.service.execute({}, 'CUSTOMER', 'target', command());
    const writes = f.writes;
    expect(
      await f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).toMatchObject({ replayed: true, version: 1 });
    expect(f.writes).toBe(writes);
    expect(f.memory.audits).toHaveLength(1);
  });
  it('rejects reuse of an ID for a different reason', async () => {
    const f = fixture();
    await f.service.execute({}, 'CUSTOMER', 'target', command());
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', {
        ...command(),
        reason: 'A different review reason',
      }),
    ).rejects.toThrow('different moderation');
    expect(f.memory.audits).toHaveLength(1);
  });
  it('rejects stale expected versions', async () => {
    const f = fixture();
    f.memory.subject = { state: 'ACTIVE', version: 4 };
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).rejects.toThrow('Account changed');
    expect(f.writes).toBe(0);
  });
  it.each(['calls', 'payments', 'locked', 'payouts'] as const)(
    'refuses unsettled %s without account writes',
    async (key) => {
      const f = fixture(true);
      f.flags[key] = 1;
      await expect(
        f.service.execute({}, 'ASTROLOGER', 'profile', command(1, 'VERIFY')),
      ).rejects.toThrow('unsettled');
      expect(f.writes).toBe(0);
    },
  );
  it.each(['actorActive', 'wrongUid'] as const)(
    'rechecks canonical authorization: %s',
    async (key) => {
      const f = fixture();
      f.flags[key] = key === 'actorActive' ? false : true;
      await expect(
        f.service.execute({}, 'CUSTOMER', 'target', command()),
      ).rejects.toThrow('authorized Admin');
      expect(f.writes).toBe(0);
    },
  );
  it('never unblocks a deactivated account', async () => {
    const f = fixture();
    f.memory.user.isActive = false;
    f.memory.user.isBlocked = true;
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', command(1, 'UNBLOCK')),
    ).rejects.toThrow('Inactive accounts');
    expect(f.writes).toBe(0);
  });
  it('rejects Admin and astrologer targets in the customer path', async () => {
    const f = fixture();
    f.memory.user.role.name = 'ADMIN';
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).rejects.toThrow('Admin accounts');
    const g = fixture(true);
    await expect(
      g.service.execute({}, 'CUSTOMER', 'target', command()),
    ).rejects.toThrow('dedicated customer');
  });
  it.each(['foreign/identity/proof.pdf', ''])(
    'cannot mark an application verified with unowned/missing identity proof: %s',
    async (path) => {
      const f = fixture(true);
      f.memory.profile!.documents.identityProof.url = path;
      await expect(
        f.service.execute({}, 'ASTROLOGER', 'profile', command(1, 'VERIFY')),
      ).rejects.toThrow('Owned identity proof');
      expect(f.memory.profile!.isVerified).toBe(false);
      expect(f.memory.audits).toHaveLength(0);
    },
  );
  it('requires explicit verification before approval and retains distinct rejection/suspension states', async () => {
    const f = fixture(true);
    await expect(
      f.service.execute({}, 'ASTROLOGER', 'profile', command(1, 'APPROVE')),
    ).rejects.toThrow('Invalid moderation transition');
    await f.service.execute({}, 'ASTROLOGER', 'profile', command(2, 'VERIFY'));
    await f.service.execute(
      {},
      'ASTROLOGER',
      'profile',
      command(3, 'APPROVE', 1),
    );
    await f.service.execute(
      {},
      'ASTROLOGER',
      'profile',
      command(4, 'SUSPEND', 2),
    );
    expect(f.memory.subject).toEqual({ state: 'SUSPENDED', version: 3 });
    expect(f.memory.profile).toMatchObject({
      isApproved: false,
      isVerified: true,
      isOnline: false,
    });
    expect(f.memory.audits).toHaveLength(3);
  });
  it('rolls back account and state when audit insertion fails; never retries', async () => {
    const f = fixture();
    f.flags.auditFails = true;
    await expect(
      f.service.execute({}, 'CUSTOMER', 'target', command()),
    ).rejects.toThrow('could not be confirmed');
    expect(f.memory.user.isBlocked).toBe(false);
    expect(f.memory.subject).toBeNull();
    expect(f.memory.audits).toHaveLength(0);
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('closes legacy route action substitution', () => {
    const service = fixture().service;
    const controller = new AdminController(
      {} as never,
      service,
      {} as never,
      {} as never,
    );
    expect(() =>
      controller.approveAstrologer({}, 'profile', command(1, 'REJECT')),
    ).toThrow('does not match');
  });
  it.each([
    { ...command(), actorId: 'forged' },
    { ...command(), reason: 'short' },
    { ...command(), expectedVersion: -1 },
    { ...command(), requestId: 'not-a-uuid' },
  ])('rejects unsafe command payload', (body) => {
    expect(() => moderationInput(body)).toThrow();
  });
  it('does not invent moderation states or silently restore rejected astrologers', () => {
    expect(() =>
      moderationTransition('ASTROLOGER', 'REJECTED', 'APPROVE'),
    ).toThrow();
    expect(() =>
      moderationTransition('CUSTOMER', 'BLOCKED', 'APPROVE'),
    ).toThrow();
  });
});
