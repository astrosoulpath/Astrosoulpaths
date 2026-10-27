import {
  prepareOrExecuteBootstrap,
  validateBootstrapOptions,
  BOOTSTRAP_APPROVAL,
} from '../../../prisma/admin-google-bootstrap';

describe('isolated Google Admin bootstrap (mock database only)', () => {
  const base = {
    databaseUrl: 'postgresql://fixture:mock@127.0.0.1:5432/astro_soul_path',
    email: 'fixture@example.invalid',
  };
  const identity = {
    uid: 'fixture-admin',
    email: base.email,
    emailVerified: true,
    disabled: false,
    googleEmail: base.email,
    googleProviderCount: 1,
  };
  let prior: string | undefined, tx: any, prisma: any, saved: any;
  beforeEach(() => {
    prior = process.env.ADMIN_ALLOWED_FIREBASE_UID;
    process.env.ADMIN_ALLOWED_FIREBASE_UID = identity.uid;
    saved = null;
    tx = {
      $executeRawUnsafe: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ ok: true }]),
      role: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'existing-lowercase-role', name: 'admin' },
          ]),
      },
      userProfile: { count: jest.fn().mockResolvedValue(0) },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'new-user',
          ...data,
        })),
      },
      userAuthIdentity: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }) => {
          saved = {
            id: 'new-mapping',
            ...data,
            user: {
              id: 'new-user',
              email: identity.email,
              roleId: 'existing-lowercase-role',
              isActive: true,
              isBlocked: false,
              supabaseId: `firebase:${identity.uid}`,
              phone: null,
              isVerified: false,
              isAstrologer: false,
            },
          };
          return saved;
        }),
        findUnique: jest.fn().mockImplementation(async () => saved),
      },
    };
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) => {
      if (parts.join('').includes('AS normalized_users'))
        return [
          {
            normalized_users: (await tx.user.findMany()).filter(
              (u: any) => u.email?.trim().toLowerCase() === identity.email,
            ).length,
            normalized_identities: (
              await tx.userAuthIdentity.findMany()
            ).filter(
              (i: any) => i.email?.trim().toLowerCase() === identity.email,
            ).length,
            normalized_profiles: await tx.userProfile.count(),
          },
        ];
      return [{ ok: true }];
    });
    prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
  });
  afterEach(() => {
    if (prior === undefined) delete process.env.ADMIN_ALLOWED_FIREBASE_UID;
    else process.env.ADMIN_ALLOWED_FIREBASE_UID = prior;
  });
  it('defaults to enforced read-only dry run with exactly two proposed inserts', async () => {
    expect(
      await prepareOrExecuteBootstrap(prisma, identity, base),
    ).toMatchObject({
      status: 'DRY_RUN_READY',
      usersCreated: 0,
      identitiesCreated: 0,
      plannedUsers: 1,
      plannedIdentities: 1,
    });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET TRANSACTION READ ONLY',
    );
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.userAuthIdentity.create).not.toHaveBeenCalled();
    expect(
      tx.$queryRaw.mock.calls.some(([query]) =>
        query.join('').includes('pg_advisory_xact_lock'),
      ),
    ).toBe(false);
  });
  it.each([
    'postgresql://mock@remote.invalid/astro_soul_path',
    'postgresql://mock@127.0.0.1/production',
    'postgresql://mock@127.0.0.1:5555/astro_soul_path',
    'postgresql://mock@127.0.0.1/astro_soul_path?schema=private',
  ])('rejects unintended target', (url) => {
    expect(() =>
      validateBootstrapOptions({ ...base, databaseUrl: url }),
    ).toThrow();
  });
  it('rejects execution without exact approval before transaction', async () => {
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, { ...base, execute: true }),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects UID/Google mismatch before transaction', async () => {
    await expect(
      prepareOrExecuteBootstrap(prisma, { ...identity, uid: 'foreign' }, base),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([{ roles: [] }, { roles: [{ id: 'a' }, { id: 'b' }] }])(
    'requires exactly one existing case-insensitive Admin role',
    async ({ roles }) => {
      tx.role.findMany.mockResolvedValue(roles);
      await expect(
        prepareOrExecuteBootstrap(prisma, identity, base),
      ).rejects.toThrow();
    },
  );
  it('does not adopt or promote an existing email owner', async () => {
    tx.user.findMany.mockResolvedValue([
      { id: 'customer', roleId: 'customer', email: identity.email },
    ]);
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, base),
    ).rejects.toThrow('CONFLICT');
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('rejects legacy profile ownership', async () => {
    tx.userProfile.count.mockResolvedValue(1);
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, base),
    ).rejects.toThrow('LEGACY_PROFILE_CONFLICT');
  });
  it('rejects partial/orphan identity state rather than repairing it', async () => {
    tx.userAuthIdentity.findMany.mockResolvedValue([{ userId: 'orphan' }]);
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, base),
    ).rejects.toThrow();
  });
  it('prepared exact mapping is an idempotent no-op even in execute mode', async () => {
    tx.user.findMany.mockResolvedValue([
      {
        id: 'already',
        email: identity.email,
        supabaseId: `firebase:${identity.uid}`,
        roleId: 'existing-lowercase-role',
        isActive: true,
        isBlocked: false,
        isAstrologer: false,
      },
    ]);
    tx.userAuthIdentity.findMany.mockResolvedValue([
      {
        userId: 'already',
        provider: 'firebase',
        providerUserId: identity.uid,
        email: identity.email,
        identityType: 'google',
      },
    ]);
    expect(
      await prepareOrExecuteBootstrap(prisma, identity, {
        ...base,
        execute: true,
        approval: BOOTSTRAP_APPROVAL,
      }),
    ).toMatchObject({ status: 'ALREADY_PREPARED' });
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('approved mocked execution creates only one user and mapping and reads back', async () => {
    expect(
      await prepareOrExecuteBootstrap(prisma, identity, {
        ...base,
        execute: true,
        approval: BOOTSTRAP_APPROVAL,
      }),
    ).toMatchObject({
      status: 'CREATED',
      usersCreated: 1,
      identitiesCreated: 1,
    });
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.userAuthIdentity.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      roleId: 'existing-lowercase-role',
      phone: null,
      isVerified: false,
      freeChatMinutes: 0,
    });
    expect(prisma.$transaction.mock.calls[0][1].isolationLevel).toBe(
      'Serializable',
    );
    expect(
      tx.$queryRaw.mock.calls.some(([query]) =>
        query.join('').includes('pg_advisory_xact_lock'),
      ),
    ).toBe(true);
  });
  it('failed readback rejects inside transaction for rollback', async () => {
    tx.userAuthIdentity.findUnique.mockResolvedValue(null);
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, {
        ...base,
        execute: true,
        approval: BOOTSTRAP_APPROVAL,
      }),
    ).rejects.toThrow('READBACK_FAILED');
  });
  it('casts the same advisory lock result and acquires it before ownership checks and inserts', async () => {
    const stages = jest.fn();
    await prepareOrExecuteBootstrap(
      prisma,
      identity,
      { ...base, execute: true, approval: BOOTSTRAP_APPROVAL },
      stages,
    );
    const index = tx.$queryRaw.mock.calls.findIndex(([query]) =>
      query.join('').includes('pg_advisory_xact_lock'),
    );
    expect(tx.$queryRaw.mock.calls[index][0].join('')).toBe(
      'SELECT pg_advisory_xact_lock(1095979057, 1196377165)::text AS lock_result',
    );
    const order = tx.$queryRaw.mock.invocationCallOrder[index];
    for (const method of [
      tx.role.findMany,
      tx.user.findMany,
      tx.userAuthIdentity.findMany,
      tx.user.create,
      tx.userAuthIdentity.create,
    ]) {
      expect(order).toBeLessThan(method.mock.invocationCallOrder[0]);
    }
    expect(stages.mock.calls.map(([stage]) => stage)).toEqual([
      'CONFIGURATION',
      'FIREBASE_VALIDATION',
      'DATABASE_TRANSACTION',
      'ADVISORY_LOCK',
      'DATABASE_TRANSACTION',
    ]);
  });
  it('lock failure stops before ownership checks or inserts with no retry', async () => {
    const original = tx.$queryRaw.getMockImplementation();
    tx.$queryRaw.mockImplementation(async (parts, ...args) => {
      if (parts.join('').includes('pg_advisory_xact_lock'))
        throw Object.assign(new Error('private metadata'), { code: 'P2010' });
      return original(parts, ...args);
    });
    const stages = jest.fn();
    await expect(
      prepareOrExecuteBootstrap(
        prisma,
        identity,
        { ...base, execute: true, approval: BOOTSTRAP_APPROVAL },
        stages,
      ),
    ).rejects.toMatchObject({ code: 'P2010' });
    expect(stages).toHaveBeenLastCalledWith('ADVISORY_LOCK');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    for (const method of [
      tx.role.findMany,
      tx.user.findMany,
      tx.userAuthIdentity.findMany,
      tx.user.create,
      tx.userAuthIdentity.create,
    ])
      expect(method).not.toHaveBeenCalled();
  });
  it('rejects whitespace-normalized ownership not returned by ordinary email lookup', async () => {
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      parts.join('').includes('AS normalized_users')
        ? [
            {
              normalized_users: 1,
              normalized_identities: 0,
              normalized_profiles: 0,
            },
          ]
        : [{ ok: true }],
    );
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, base),
    ).rejects.toThrow('NORMALIZED_EMAIL_CONFLICT');
    expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('unexpected application triggers stop preparation', async () => {
    tx.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) => [
      { ok: !parts.join('').includes('pg_trigger') },
    ]);
    await expect(
      prepareOrExecuteBootstrap(prisma, identity, base),
    ).rejects.toThrow('UNREVIEWED_TRIGGER');
  });
});
