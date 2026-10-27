import { ConfigService } from '@nestjs/config';
import { hasLiveV2Schema } from './live-schema-compatibility';
jest.mock('./live-schema-compatibility', () => ({
  ...jest.requireActual('./live-schema-compatibility'),
  hasLiveV2Schema: jest.fn().mockResolvedValue(true),
}));
import { ValidationPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { LiveV2Service } from './live-v2.service';
import { LiveV2Events } from './live-v2.events';
import { LiveV2Controller } from './live-v2.controller';
import {
  LiveCreateDto,
  LiveDiscoveryDto,
  LiveStartDto,
  LiveProofDto,
  LiveResumeDto,
} from './live-v2.dto';

// Do not load Firebase/Jose native authentication in these isolated unit tests.
// Metadata tests check guard wiring only; they do not verify Firebase tokens.
jest.mock('../../common/guards/supabase-auth.guard', () => ({
  SupabaseAuthGuard: class SupabaseAuthGuard {},
}));

describe('Live v2 lifecycle (mock database, not PostgreSQL integration)', () => {
  let state: any;
  let db: any;
  let agora: any;
  let service: LiveV2Service;
  let now: Date;
  let events: LiveV2Events;
  let notified: jest.Mock;
  let transactionActive: boolean;
  let failCommit: boolean;
  const actor = (sub = 'host') => ({
    sub,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const create = () => ({
    joinRequestId: randomUUID(),
    resumeSecret: randomBytes(32).toString('base64url'),
  });
  const proof = (body: any, generation = 1) => ({
    resumeSecret: body.resumeSecret,
    generation,
  });
  const matches = (record: any, where: any) =>
    Object.entries(where).every(([key, value]: any) => {
      if (key === 'OR')
        return value.some((clause: any) => matches(record, clause));
      if (value && typeof value === 'object' && 'gt' in value)
        return record[key] > value.gt;
      if (value && typeof value === 'object' && 'lte' in value)
        return record[key] <= value.lte;
      if (value && typeof value === 'object' && 'not' in value)
        return record[key] !== value.not;
      if (value && typeof value === 'object' && 'is' in value)
        return value.is === null
          ? record[key] == null
          : !!record[key] && matches(record[key], value.is);
      if (value && typeof value === 'object')
        return !!record[key] && matches(record[key], value);
      return record[key] === value;
    });
  it('rejects v2 before state queries when migration is absent', async () => {
    (hasLiveV2Schema as jest.Mock).mockResolvedValue(false);
    await expect(service.start(actor(), create())).rejects.toThrow(
      'requires the approved schema migration',
    );
    expect(db.userAuthIdentity.findUnique).not.toHaveBeenCalled();
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });

  it('discovery query DTO coerces bounded integers and rejects unknown fields', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata: any = { type: 'query', metatype: LiveDiscoveryDto };
    expect(
      await pipe.transform({ offset: '2', limit: '10' }, metadata),
    ).toEqual(expect.objectContaining({ offset: 2, limit: 10 }));
    for (const query of [
      { limit: '51' },
      { offset: '-1' },
      { limit: 'abc' },
      { role: 'PUBLISHER' },
    ]) {
      await expect(pipe.transform(query, metadata)).rejects.toThrow();
    }
  });
  describe('authenticated v2 discovery', () => {
    const listed = async () => {
      const result = await service.start(actor(), create());
      return db.liveSession.findUnique({
        where: { id: result.data.session.id },
      });
    };
    it('returns eligible sessions and safe display fields only', async () => {
      const row = await listed();
      db.liveSession.findMany.mockResolvedValue([row]);
      const result = await service.discover(actor('foreign'), {
        offset: 0,
        limit: 20,
      });
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0]).toEqual(
        expect.objectContaining({
          id: row.id,
          connectionProtocol: 2,
          viewerCount: 0,
        }),
      );
      expect(JSON.stringify(result)).not.toMatch(
        /resumeSecret|Hash|agoraUid|channelName|hostConnectionId|generation|token/,
      );
      expect(db.liveSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            connectionProtocol: 2,
            status: 'LIVE',
            endedAt: null,
            astrologer: expect.objectContaining({
              isApproved: true,
              isVerified: true,
            }),
            hostConnection: {
              is: {
                role: 'PUBLISHER',
                closedAt: null,
                leaseExpiresAt: { gt: expect.any(Date) },
              },
            },
          }),
          take: 21,
          skip: 0,
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });
    it.each([
      'expired',
      'closed',
      'foreign-session',
      'foreign-user',
      'pending',
      'blocked',
      'ended',
    ])(
      'omits %s host/session even if stale query returns it',
      async (condition) => {
        const row = await listed();
        if (condition === 'expired')
          row.hostConnection.leaseExpiresAt = new Date(0);
        if (condition === 'closed') row.hostConnection.closedAt = now;
        if (condition === 'foreign-session')
          row.hostConnection.liveSessionId = 'foreign';
        if (condition === 'foreign-user') row.hostConnection.userId = 'foreign';
        if (condition === 'pending') row.astrologer.isApproved = false;
        if (condition === 'blocked') row.astrologer.user.isBlocked = true;
        if (condition === 'ended') row.status = 'ENDED';
        db.liveSession.findMany.mockResolvedValue([row]);
        // Use independent eligible viewer, since the host can be blocked.
        expect(
          (await service.discover(actor('foreign'), { offset: 0, limit: 20 }))
            .data.sessions,
        ).toEqual([]);
      },
    );
    it('uses bounded pagination and never returns lookahead row', async () => {
      const row = await listed();
      db.liveSession.findMany.mockResolvedValue([row, row]);
      const result = await service.discover(actor(), { offset: 4, limit: 1 });
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.nextOffset).toBe(5);
      expect(db.liveSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 4, take: 2 }),
      );
    });
    it.each([
      { offset: -1, limit: 20 },
      { offset: 0, limit: 51 },
      { offset: 0, limit: 1.5 },
    ])('rejects invalid pagination %j', async (query) => {
      await expect(service.discover(actor(), query)).rejects.toThrow(
        'pagination',
      );
    });
    it('rejects unauthenticated and blocked viewers', async () => {
      await expect(
        service.discover({}, { offset: 0, limit: 20 }),
      ).rejects.toThrow('authenticated');
      state.users.foreign.isBlocked = true;
      await expect(
        service.discover(actor('foreign'), { offset: 0, limit: 20 }),
      ).rejects.toThrow('Live account unavailable');
      expect(db.liveSession.findMany).not.toHaveBeenCalled();
    });
    it('fails closed on pre-v2 schema', async () => {
      (hasLiveV2Schema as jest.Mock).mockResolvedValue(false);
      await expect(
        service.discover(actor(), { offset: 0, limit: 20 }),
      ).rejects.toThrow('requires the approved schema migration');
      expect(db.liveSession.findMany).not.toHaveBeenCalled();
    });
  });
  it('master flag disabled rejects before any database transaction', async () => {
    const disabled = new LiveV2Service(
      db,
      agora,
      events,
      new ConfigService({ LIVE_V2_ENABLED: 'false' }),
    );
    await expect(disabled.start(actor(), create())).rejects.toThrow(
      'not enabled',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    (hasLiveV2Schema as jest.Mock).mockResolvedValue(true);
    now = new Date();
    transactionActive = false;
    failCommit = false;
    const host: any = {
      id: 'host',
      supabaseId: 'host',
      name: 'Host',
      isActive: true,
      isBlocked: false,
      isAstrologer: true,
      astrologer: {
        id: 'astro',
        userId: 'host',
        isApproved: true,
        isVerified: true,
      },
    };
    state = {
      users: {
        host,
        viewer: {
          id: 'viewer',
          supabaseId: 'viewer',
          isActive: true,
          isBlocked: false,
          isAstrologer: false,
          astrologer: null,
        },
        foreign: {
          id: 'foreign',
          supabaseId: 'foreign',
          isActive: true,
          isBlocked: false,
          isAstrologer: false,
          astrologer: null,
        },
      },
      sessions: {},
      connections: {},
      viewers: {},
    };
    const session = (s: any) =>
      s
        ? {
            ...s,
            astrologer: {
              ...state.users.host.astrologer,
              user: state.users.host,
            },
            hostConnection: state.connections[s.hostConnectionId] ?? null,
          }
        : null;
    db = {
      $queryRaw: jest.fn(async (parts: TemplateStringsArray) =>
        parts.join('').includes('clock_timestamp')
          ? [{ now }]
          : [{ id: 'locked' }],
      ),
      userAuthIdentity: {
        findUnique: jest.fn(async ({ where }: any) =>
          state.users[where.provider_providerUserId.providerUserId]
            ? { userId: where.provider_providerUserId.providerUserId }
            : null,
        ),
      },
      user: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            state.users[where.id ?? where.supabaseId] ?? null,
        ),
      },
      liveSession: {
        findMany: jest.fn(async ({ where }: any) =>
          Object.values(state.sessions)
            .map(session)
            .filter((s: any) => matches(s, where)),
        ),
        findUnique: jest.fn(async ({ where }: any) =>
          session(state.sessions[where.id]),
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          session(
            Object.values(state.sessions).find((s: any) => matches(s, where)),
          ),
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = {
            id: randomUUID(),
            endedAt: null,
            hostConnectionId: null,
            startedAt: now,
            ...data,
          };
          state.sessions[row.id] = row;
          return session(row);
        }),
        update: jest.fn(async ({ where, data }: any) => {
          Object.assign(state.sessions[where.id], data);
          return session(state.sessions[where.id]);
        }),
      },
      liveConnection: {
        findMany: jest.fn(async ({ where }: any) =>
          Object.values(state.connections)
            .map((c: any) => ({
              ...c,
              liveSession: state.sessions[c.liveSessionId],
            }))
            .filter((c: any) => matches(c, where)),
        ),
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id) return state.connections[where.id] ?? null;
          const filter =
            where.userId_joinRequestId ?? where.liveSessionId_agoraUid;
          return (
            Object.values(state.connections).find((c: any) =>
              matches(c, filter),
            ) ?? null
          );
        }),
        create: jest.fn(async ({ data }: any) => {
          const c = {
            id: randomUUID(),
            closedAt: null,
            lastResumeRequestId: null,
            ...data,
          };
          state.connections[c.id] = c;
          return { ...c };
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const c = state.connections[where.id];
          const values = { ...data };
          if (values.generation?.increment)
            values.generation = c.generation + values.generation.increment;
          Object.assign(c, values);
          return { ...c };
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          for (const c of Object.values(state.connections) as any[])
            if (matches(c, where)) Object.assign(c, data);
          return { count: 1 };
        }),
        count: jest.fn(
          async ({ where }: any) =>
            Object.values(state.connections).filter((c: any) =>
              matches(c, where),
            ).length,
        ),
      },
      liveViewer: {
        create: jest.fn(async ({ data }: any) => {
          const v = { id: randomUUID(), leftAt: null, ...data };
          state.viewers[v.id] = v;
          return v;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          for (const v of Object.values(state.viewers) as any[])
            if (matches(v, where)) Object.assign(v, data);
          return { count: 1 };
        }),
      },
      liveMessage: {
        create: jest.fn(async ({ data }: any) => ({
          id: randomUUID(),
          createdAt: now,
          ...data,
        })),
      },
    };
    // Serialize the mock transactions and emulate rollback. This is not proof
    // that the PostgreSQL locks/constraints work in a real deployment.
    let queue = Promise.resolve();
    db.$transaction = jest.fn(async (work: any) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const clone = (value: any): any => {
        if (value instanceof Date) return new Date(value.getTime());
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object')
          return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, clone(v)]),
          );
        return value;
      };
      const before = clone(state);
      transactionActive = true;
      try {
        const result = await work(db);
        if (failCommit) {
          failCommit = false;
          throw new Error('Mock commit failed');
        }
        return result;
      } catch (e) {
        state = before;
        throw e;
      } finally {
        transactionActive = false;
        release();
      }
    });
    agora = {
      generateRtcToken: jest.fn((channelName, uid, role, cap) => ({
        channelName,
        uid,
        role,
        expiresIn: cap,
        token: 'test-token',
      })),
    };
    events = new LiveV2Events();
    notified = jest.fn(() => transactionActive);
    events.subscribe(notified);
    service = new LiveV2Service(
      db,
      agora,
      events,
      new ConfigService({ LIVE_V2_ENABLED: 'true' }),
    );
  });
  async function started() {
    const body = create();
    const result = await service.start(actor(), body);
    return { body, ...result.data };
  }
  async function joined() {
    const host = await started();
    const body = create();
    const result = await service.join(actor('viewer'), host.session.id, body);
    return { host, body, ...result.data };
  }

  it('start retries preserve designated host, UID and channel without leaking the hash', async () => {
    const body = create();
    const one = await service.start(actor(), body);
    const two = await service.start(actor(), body);
    expect(two.data.connection.id).toBe(one.data.connection.id);
    expect(two.data.rtc).toEqual(one.data.rtc);
    expect(db.liveSession.create).toHaveBeenCalledTimes(1);
    expect(db.liveConnection.create).toHaveBeenCalledTimes(1);
    expect(state.connections[one.data.connection.id].resumeSecretHash).toBe(
      createHash('sha256')
        .update(Buffer.from(body.resumeSecret, 'base64url'))
        .digest('hex'),
    );
    expect(JSON.stringify(one)).not.toContain('resumeSecretHash');
    expect(JSON.stringify(one)).not.toContain(body.resumeSecret);
  });
  it('join retries do not create duplicate presence', async () => {
    const { host, body, connection } = await joined();
    const retry = await service.join(actor('viewer'), host.session.id, body);
    expect(retry.data.connection.id).toBe(connection.id);
    expect(db.liveViewer.create).toHaveBeenCalledTimes(1);
  });
  it.each(['host', 'viewer'])(
    '%s renewal preserves stored UID, channel and role',
    async (kind) => {
      const item = await joined();
      const c = kind === 'host' ? item.host : item;
      const who = kind === 'host' ? 'host' : 'viewer';
      const result = await service.operate(
        actor(who),
        c.session.id,
        c.connection.id,
        'renew',
        proof(c.body),
      );
      expect(result.data).toEqual(
        expect.objectContaining({ rtc: expect.objectContaining(c.rtc) }),
      );
      expect(db.liveConnection.update).not.toHaveBeenCalled();
      expect(db.liveViewer.create).toHaveBeenCalledTimes(1);
    },
  );
  it('cross-account connection reuse is rejected', async () => {
    const c = await joined();
    await expect(
      service.operate(
        actor('foreign'),
        c.session.id,
        c.connection.id,
        'renew',
        proof(c.body),
      ),
    ).rejects.toThrow('ownership');
  });
  it('wrong resume secret is rejected', async () => {
    const c = await joined();
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'renew',
        proof(create()),
      ),
    ).rejects.toThrow('ownership');
  });
  it('resume increments once, rejects old generation and is retryable', async () => {
    const c = await joined();
    const body = { ...proof(c.body), resumeRequestId: randomUUID() };
    const first = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'resume',
      body,
    );
    const retry = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'resume',
      body,
    );
    if (!('connection' in first.data) || !('connection' in retry.data)) {
      throw new Error('Expected connection acknowledgements after resume');
    }
    expect(first.data.connection.generation).toBe(2);
    expect(retry.data.connection.generation).toBe(2);
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'heartbeat',
        proof(c.body),
      ),
    ).rejects.toThrow('Stale');
  });
  it('two customer devices are independent; one leave preserves the other', async () => {
    const c = await joined();
    const other = await service.join(actor('viewer'), c.session.id, create());
    expect(other.data.connection.id).not.toBe(c.connection.id);
    expect(other.data.rtc.uid).not.toBe(c.rtc.uid);
    const left = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'leave',
      proof(c.body),
    );
    expect(left.data.viewerCount).toBe(1);
    expect(state.connections[other.data.connection.id].closedAt).toBeNull();
    expect(
      Object.values(state.viewers).filter((v: any) => v.leftAt === null),
    ).toHaveLength(1);
  });
  it('leave is idempotent and prevents renewed access', async () => {
    const c = await joined();
    const first = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'leave',
      proof(c.body),
    );
    now = new Date(now.getTime() + 1000);
    const retry = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'leave',
      proof(c.body),
    );
    if (!('closedAt' in first.data) || !('closedAt' in retry.data)) {
      throw new Error('Expected leave acknowledgements');
    }
    expect(retry.data.closedAt).toEqual(first.data.closedAt);
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'renew',
        proof(c.body),
      ),
    ).rejects.toThrow('closed');
  });
  it('end closes connections once, preserves endedAt and rejects renewal', async () => {
    const c = await joined();
    const h = c.host;
    const first = await service.operate(
      actor(),
      h.session.id,
      h.connection.id,
      'end',
      proof(h.body),
    );
    now = new Date(now.getTime() + 1000);
    const retry = await service.operate(
      actor(),
      h.session.id,
      h.connection.id,
      'end',
      proof(h.body),
    );
    if (!('endedAt' in first.data) || !('endedAt' in retry.data)) {
      throw new Error('Expected end acknowledgements');
    }
    expect(retry.data.endedAt).toEqual(first.data.endedAt);
    expect(db.liveSession.update).toHaveBeenCalledTimes(2); // designation + first end
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'renew',
        proof(c.body),
      ),
    ).rejects.toThrow('ended');
  });
  it('subscriber cannot end or obtain publisher privileges', async () => {
    const c = await joined();
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'end',
        proof(c.body),
      ),
    ).rejects.toThrow('Approved');
    expect(c.rtc.role).toBe('SUBSCRIBER');
  });
  it('pending astrologer cannot start', async () => {
    state.users.host.astrologer.isApproved = false;
    await expect(service.start(actor(), create())).rejects.toThrow('Approved');
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('revoked host approval prevents renewal and viewer join', async () => {
    const c = await joined();
    state.users.host.astrologer.isApproved = false;
    await expect(
      service.operate(
        actor(),
        c.session.id,
        c.host.connection.id,
        'renew',
        proof(c.host.body),
      ),
    ).rejects.toThrow('host unavailable');
    await expect(
      service.join(actor('foreign'), c.session.id, create()),
    ).rejects.toThrow('host unavailable');
  });
  it('expired viewer heartbeat cannot revive presence', async () => {
    const c = await joined();
    now = new Date(now.getTime() + 46_000);
    await expect(
      service.operate(
        actor('viewer'),
        c.session.id,
        c.connection.id,
        'heartbeat',
        proof(c.body),
      ),
    ).rejects.toThrow('expired');
    const status = await service.status(actor(), c.session.id);
    expect(status.data.viewerCount).toBe(0);
  });
  it('host timeout is unavailable without falsely writing ENDED', async () => {
    const h = await started();
    now = new Date(now.getTime() + 61_000);
    await expect(
      service.join(actor('viewer'), h.session.id, create()),
    ).rejects.toThrow('host lease');
    const status = await service.status(actor('viewer'), h.session.id);
    expect(status.data).toEqual(
      expect.objectContaining({
        status: 'LIVE',
        hostLeaseValid: false,
        viewerCount: 0,
      }),
    );
  });
  it('v2 refuses protocol-1 sessions and does not upgrade history', async () => {
    const h = await started();
    state.sessions[h.session.id].connectionProtocol = 1;
    await expect(
      service.join(actor('viewer'), h.session.id, create()),
    ).rejects.toThrow('protocol');
  });
  it('simultaneous mock starts create only one session; other device gets conflict', async () => {
    const results = await Promise.allSettled([
      service.start(actor(), create()),
      service.start(actor(), create()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(Object.keys(state.sessions)).toHaveLength(1);
    expect(
      db.$queryRaw.mock.calls.some(([parts]: any) =>
        parts.join('').includes('FOR UPDATE'),
      ),
    ).toBe(true);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
    });
  });
  it('idempotency key cannot be reused for another secret', async () => {
    const h = await started();
    await expect(
      service.start(actor(), {
        ...h.body,
        resumeSecret: create().resumeSecret,
      }),
    ).rejects.toThrow('ownership');
  });
  it.each([
    {},
    { sub: 'host' },
    { sub: 'host', exp: 0 },
    { sub: 'unknown', exp: 9999999999 },
  ])(
    'fails closed for missing/invalid authentication (%p)',
    async (invalid) => {
      await expect(service.start(invalid, create())).rejects.toThrow();
      expect(agora.generateRtcToken).not.toHaveBeenCalled();
    },
  );
  it('caps tokens by authentication lifetime and requires refresh near expiry', async () => {
    const h = await started();
    const exp = Math.floor(now.getTime() / 1000) + 30;
    const short = await service.operate(
      { sub: 'host', exp },
      h.session.id,
      h.connection.id,
      'renew',
      proof(h.body),
    );
    if (!('rtc' in short.data) || !short.data.rtc) {
      throw new Error('Expected RTC credentials after renewal');
    }
    expect(short.data.rtc.expiresIn).toBeLessThanOrEqual(30);
    await expect(
      service.operate(
        { sub: 'host', exp: Math.floor(now.getTime() / 1000) + 5 },
        h.session.id,
        h.connection.id,
        'renew',
        proof(h.body),
      ),
    ).rejects.toThrow('Refresh');
  });
  it('status never returns secrets, hashes or connection ownership', async () => {
    const h = await started();
    const result = await service.status(actor('viewer'), h.session.id);
    expect(Object.keys(result.data).sort()).toEqual([
      'endedAt',
      'hostLeaseValid',
      'serverTime',
      'sessionId',
      'status',
      'viewerCount',
    ]);
  });
  it('missing host binding fails closed', async () => {
    const h = await started();
    state.sessions[h.session.id].hostConnectionId = null;
    await expect(
      service.join(actor('viewer'), h.session.id, create()),
    ).rejects.toThrow('host lease');
  });
  it('token creation failure rolls back the mock session and presence', async () => {
    agora.generateRtcToken.mockImplementation(() => {
      throw new Error('token unavailable');
    });
    await expect(service.start(actor(), create())).rejects.toThrow(
      'token unavailable',
    );
    expect(Object.keys(state.sessions)).toHaveLength(0);
    expect(Object.keys(state.connections)).toHaveLength(0);
  });
  it('all v2 routes inherit the existing authentication guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LiveV2Controller)).toContain(
      SupabaseAuthGuard,
    );
  });
  it.each([LiveStartDto, LiveCreateDto, LiveProofDto, LiveResumeDto])(
    'strict DTO validation accepts the contract and rejects client identity/role fields (%p)',
    async (metatype) => {
      const body =
        metatype === LiveProofDto
          ? proof(create())
          : metatype === LiveResumeDto
            ? { ...proof(create()), resumeRequestId: randomUUID() }
            : create();
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
      await expect(
        pipe.transform(body, { type: 'body', metatype }),
      ).resolves.toBeDefined();
      for (const extra of [
        { uid: 1 },
        { role: 'PUBLISHER' },
        { channelName: 'foreign-channel' },
        { userId: 'foreign' },
      ]) {
        await expect(
          pipe.transform({ ...body, ...extra }, { type: 'body', metatype }),
        ).rejects.toThrow();
      }
    },
  );
  it('heartbeat uses the database clock and does not mint or renew tokens', async () => {
    const c = await joined();
    now = new Date(now.getTime() + 15_000);
    agora.generateRtcToken.mockClear();
    const heartbeat = await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'heartbeat',
      proof(c.body),
    );
    if (!('connection' in heartbeat.data)) {
      throw new Error('Expected connection acknowledgement after heartbeat');
    }
    expect(heartbeat.data.connection.leaseExpiresAt).toEqual(
      new Date(now.getTime() + 45_000),
    );
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('changed start payload cannot reuse an idempotency key', async () => {
    const h = await started();
    await expect(
      service.start(actor(), { ...h.body, title: 'different' }),
    ).rejects.toThrow('payload conflict');
  });
  it('approval revoked before acquiring the host lock fails closed', async () => {
    db.$queryRaw.mockImplementation(async (parts: TemplateStringsArray) =>
      parts.join('').includes('clock_timestamp')
        ? [{ now }]
        : parts.join('').includes('"isApproved"')
          ? []
          : [{ id: 'locked' }],
    );
    await expect(service.start(actor(), create())).rejects.toThrow('Approved');
    expect(agora.generateRtcToken).not.toHaveBeenCalled();
  });
  it('bind validates foreign/wrong proofs before claiming a socket generation', async () => {
    const c = await joined();
    const body = { ...proof(c.body), resumeRequestId: randomUUID() };
    await expect(
      service.bindSocket(actor('foreign'), c.session.id, c.connection.id, body),
    ).rejects.toThrow('ownership');
    await expect(
      service.bindSocket(actor('viewer'), c.session.id, c.connection.id, {
        ...body,
        resumeSecret: create().resumeSecret,
      }),
    ).rejects.toThrow('ownership');
    expect(state.connections[c.connection.id].generation).toBe(1);
  });
  it('bind retries recover a lost acknowledgement without another generation increment', async () => {
    const c = await joined();
    const body = { ...proof(c.body), resumeRequestId: randomUUID() };
    const first = await service.bindSocket(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      body,
    );
    const retry = await service.bindSocket(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      body,
    );
    expect(first.generation).toBe(2);
    expect(retry).toEqual(first);
    expect(JSON.stringify(first)).not.toContain(c.body.resumeSecret);
  });
  it('socket messages recheck generation and canonical ownership', async () => {
    const c = await joined();
    const binding = await service.bindSocket(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      { ...proof(c.body), resumeRequestId: randomUUID() },
    );
    await service.socketMessage(actor('viewer'), binding, 'valid question');
    expect(db.liveMessage.create).toHaveBeenCalledTimes(1);
    await expect(
      service.socketMessage(actor('foreign'), binding, 'foreign'),
    ).rejects.toThrow('ownership');
    await service.operate(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      'resume',
      { ...proof(c.body, 2), resumeRequestId: randomUUID() },
    );
    await expect(
      service.socketMessage(actor('viewer'), binding, 'stale'),
    ).rejects.toThrow('Stale');
    expect(db.liveMessage.create).toHaveBeenCalledTimes(1);
  });
  it('socket heartbeat extends only the currently bound connection', async () => {
    const c = await joined();
    const binding = await service.bindSocket(
      actor('viewer'),
      c.session.id,
      c.connection.id,
      { ...proof(c.body), resumeRequestId: randomUUID() },
    );
    now = new Date(now.getTime() + 15_000);
    const result = await service.socketHeartbeat(actor('viewer'), binding);
    expect(result.connection.leaseExpiresAt).toEqual(
      new Date(now.getTime() + 45_000),
    );
    await expect(
      service.socketHeartbeat({ ...actor('viewer'), exp: 0 }, binding),
    ).rejects.toThrow('authenticated');
  });
  it('host end event is published once and only after commit', async () => {
    const h = await started();
    await service.operate(
      actor(),
      h.session.id,
      h.connection.id,
      'end',
      proof(h.body),
    );
    await service.operate(
      actor(),
      h.session.id,
      h.connection.id,
      'end',
      proof(h.body),
    );
    expect(notified).toHaveBeenCalledTimes(1);
    expect(notified.mock.results[0].value).toBe(false);
    expect(notified.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        sessionId: h.session.id,
        reason: 'EXPLICIT_END',
        status: 'ENDED',
      }),
    );
  });
  it('failed commit publishes no ended event and rolls back the mock state', async () => {
    const h = await started();
    failCommit = true;
    await expect(
      service.operate(
        actor(),
        h.session.id,
        h.connection.id,
        'end',
        proof(h.body),
      ),
    ).rejects.toThrow('commit');
    expect(notified).not.toHaveBeenCalled();
    expect(state.sessions[h.session.id].status).toBe('LIVE');
  });
  it('temporary disconnect cannot end a host with an unexpired lease', async () => {
    const h = await started();
    now = new Date(now.getTime() + 30_000);
    await service.sweepLeases();
    expect(notified).not.toHaveBeenCalled();
    expect(state.sessions[h.session.id].status).toBe('LIVE');
  });
  it('timeout closes connections/viewers, publishes once and preserves endedAt on later end', async () => {
    const c = await joined();
    now = new Date(now.getTime() + 61_000);
    await service.sweepLeases();
    const endedAt = state.sessions[c.session.id].endedAt;
    expect(state.sessions[c.session.id].status).toBe('ENDED');
    expect(
      Object.values(state.connections).every(
        (entry: any) => entry.closedAt !== null,
      ),
    ).toBe(true);
    expect(
      Object.values(state.viewers).every((entry: any) => entry.leftAt !== null),
    ).toBe(true);
    await service.sweepLeases();
    await service.operate(
      actor(),
      c.session.id,
      c.host.connection.id,
      'end',
      proof(c.host.body),
    );
    expect(notified).toHaveBeenCalledTimes(1);
    expect(notified.mock.calls[0][0].reason).toBe('HOST_LEASE_EXPIRED');
    expect(state.sessions[c.session.id].endedAt).toEqual(endedAt);
    const status = await service.status(actor('viewer'), c.session.id);
    expect(status.data).toEqual(
      expect.objectContaining({ status: 'ENDED', endedAt, viewerCount: 0 }),
    );
  });
  it('expired viewer cleanup preserves host and the other device', async () => {
    const c = await joined();
    now = new Date(now.getTime() + 20_000);
    const second = await service.join(actor('viewer'), c.session.id, create());
    now = new Date(now.getTime() + 26_000);
    await service.sweepLeases();
    expect(state.connections[c.connection.id].closedAt).not.toBeNull();
    expect(state.connections[second.data.connection.id].closedAt).toBeNull();
    expect(state.sessions[c.session.id].status).toBe('LIVE');
    expect(
      (await service.status(actor('viewer'), c.session.id)).data.viewerCount,
    ).toBe(1);
  });
  it('explicit end racing timeout transitions once in serialized mock transactions', async () => {
    const h = await started();
    now = new Date(now.getTime() + 61_000);
    await Promise.all([
      service.sweepLeases(),
      service.operate(
        actor(),
        h.session.id,
        h.connection.id,
        'end',
        proof(h.body),
      ),
    ]);
    expect(notified).toHaveBeenCalledTimes(1);
    expect(state.sessions[h.session.id].status).toBe('ENDED');
  });
  it('timeout rechecks a refreshed host lease after a stale scan', async () => {
    const h = await started();
    now = new Date(now.getTime() + 61_000);
    db.liveConnection.findMany.mockImplementationOnce(async () => {
      state.connections[h.connection.id].leaseExpiresAt = new Date(
        now.getTime() + 60_000,
      );
      return [];
    });
    await service.sweepLeases();
    expect(notified).not.toHaveBeenCalled();
    expect(state.sessions[h.session.id].status).toBe('LIVE');
  });
  it('maintenance never auto-ends or rewrites protocol-1 sessions', async () => {
    const h = await started();
    state.sessions[h.session.id].connectionProtocol = 1;
    now = new Date(now.getTime() + 90_000);
    await service.sweepLeases();
    expect(state.sessions[h.session.id].status).toBe('LIVE');
    expect(notified).not.toHaveBeenCalled();
    expect(state.connections[h.connection.id].closedAt).toBeNull();
  });
});
