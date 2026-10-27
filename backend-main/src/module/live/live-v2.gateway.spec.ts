import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { LiveV2Gateway } from './live-v2.gateway';
import { LiveV2Events, type LiveEndedEvent } from './live-v2.events';
import { LiveV2Worker } from './live-v2.worker';

jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({
  SupabaseJwtService: class SupabaseJwtService {},
}));

describe('Live v2 socket binding (mock JWT, service and Socket.IO)', () => {
  let gateway: LiveV2Gateway;
  let live: any;
  let jwt: any;
  let events: LiveV2Events;
  let cfg: ConfigService;
  let payload: any;
  let binding: any;
  let actor: any;
  function client() {
    const socket: any = {
      id: randomUUID(),
      connected: true,
      handshake: { auth: { ...payload } },
      join: jest.fn(async () => {}),
      emit: jest.fn(),
    };
    socket.disconnect = jest.fn(() => {
      socket.connected = false;
      gateway.handleDisconnect(socket);
    });
    return socket;
  }
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-14T00:00:00Z'));
    actor = {
      sub: 'canonical-subject',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    payload = {
      token: 'mock-verified-token',
      liveSessionId: 'session',
      connectionId: randomUUID(),
      resumeSecret: randomBytes(32).toString('base64url'),
      generation: 1,
      resumeRequestId: randomUUID(),
    };
    binding = {
      sessionId: 'session',
      connectionId: payload.connectionId,
      userId: 'canonical',
      generation: 2,
    };
    live = {
      bindSocket: jest.fn(async () => ({ ...binding })),
      socketAccess: jest.fn(async () => ({ ...binding })),
      socketHeartbeat: jest.fn(async () => ({ connection: { generation: 2 } })),
      socketMessage: jest.fn(async () => ({
        id: 'message',
        message: 'question',
      })),
    };
    jwt = { verifyAccessToken: jest.fn(async () => ({ ...actor })) };
    events = new LiveV2Events();
    cfg = new ConfigService({
      LIVE_V2_ENABLED: 'true',
      LIVE_V2_SOCKET_ENABLED: 'true',
      LIVE_V2_SOCKET_SINGLE_INSTANCE: 'true',
      LIVE_V2_MAINTENANCE_ENABLED: 'true',
    });
    gateway = new LiveV2Gateway(live, jwt, events, cfg);
    gateway.afterInit();
  });
  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });
  it('authenticates, binds canonical generation and joins the v2 room before acknowledging', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    expect(jwt.verifyAccessToken).toHaveBeenCalledWith('mock-verified-token');
    expect(live.bindSocket).toHaveBeenCalledWith(
      actor,
      'session',
      payload.connectionId,
      expect.objectContaining({
        resumeSecret: payload.resumeSecret,
        generation: 1,
      }),
    );
    expect(socket.join).toHaveBeenCalledWith('live:v2:session');
    expect(socket.emit).toHaveBeenCalledWith(
      'live:connected',
      expect.objectContaining({ generation: 2 }),
    );
    expect(socket.handshake.auth.token).toBeUndefined();
    expect(socket.handshake.auth.resumeSecret).toBeUndefined();
  });
  it('fails closed by default without touching token verification or the service', async () => {
    cfg.set('LIVE_V2_SOCKET_ENABLED', 'false');
    const socket = client();
    await gateway.handleConnection(socket);
    expect(socket.connected).toBe(false);
    expect(live.bindSocket).not.toHaveBeenCalled();
  });
  it('requires explicit single-instance and maintenance activation', async () => {
    cfg.set('LIVE_V2_SOCKET_SINGLE_INSTANCE', 'false');
    const socket = client();
    await gateway.handleConnection(socket);
    expect(socket.connected).toBe(false);
    expect(live.bindSocket).not.toHaveBeenCalled();
  });
  it('rejects invalid authentication and never joins a room', async () => {
    jwt.verifyAccessToken.mockRejectedValue(new Error('invalid token'));
    const socket = client();
    await gateway.handleConnection(socket);
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.connected).toBe(false);
  });
  it.each(['foreign owner', 'wrong proof', 'stale generation'])(
    'rejects service-denied binding (%s) without exposing proofs',
    async (reason) => {
      live.bindSocket.mockRejectedValue(new Error(reason));
      const socket = client();
      await gateway.handleConnection(socket);
      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.connected).toBe(false);
      expect(JSON.stringify(socket.emit.mock.calls)).not.toContain(
        payload.resumeSecret,
      );
      expect(JSON.stringify(socket.emit.mock.calls)).not.toContain(
        payload.token,
      );
    },
  );
  it('rejects client-selected UID or role during handshake', async () => {
    const socket = client();
    socket.handshake.auth.uid = 17;
    socket.handshake.auth.role = 'PUBLISHER';
    await gateway.handleConnection(socket);
    expect(live.bindSocket).not.toHaveBeenCalled();
    expect(socket.connected).toBe(false);
  });
  it('duplicate same-generation binding is rejected without disconnecting the first socket', async () => {
    const first = client();
    await gateway.handleConnection(first);
    const second = client();
    await gateway.handleConnection(second);
    expect(first.connected).toBe(true);
    expect(second.connected).toBe(false);
  });
  it('newer generation replaces the previous local socket', async () => {
    const first = client();
    await gateway.handleConnection(first);
    binding.generation = 3;
    const second = client();
    await gateway.handleConnection(second);
    expect(first.connected).toBe(false);
    expect(second.connected).toBe(true);
  });
  it('disconnect does not end Live or modify a lease; authorized reconnect rejoins', async () => {
    const first = client();
    await gateway.handleConnection(first);
    first.disconnect();
    expect(live.socketHeartbeat).not.toHaveBeenCalled();
    binding.generation = 3;
    const second = client();
    await gateway.handleConnection(second);
    expect(second.join).toHaveBeenCalledWith('live:v2:session');
    expect(second.connected).toBe(true);
  });
  it('expiry requires fresh authentication and disconnects without silently renewing', async () => {
    actor.exp = Math.floor(Date.now() / 1000) + 1;
    const socket = client();
    await gateway.handleConnection(socket);
    jest.advanceTimersByTime(1100);
    expect(socket.emit).toHaveBeenCalledWith('live:auth-required', {
      code: 'AUTH_EXPIRED',
    });
    expect(socket.disconnect).toHaveBeenCalledWith(false);
    expect(socket.connected).toBe(false);
    await gateway.heartbeat(socket, {});
    expect(live.socketHeartbeat).not.toHaveBeenCalled();
  });
  it('revoked token and account switching reject protected socket operations', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    jwt.verifyAccessToken.mockResolvedValue({ ...actor, sub: 'foreign' });
    await gateway.heartbeat(socket, {});
    expect(live.socketHeartbeat).not.toHaveBeenCalled();
    expect(socket.connected).toBe(false);
  });
  it('master flag blocks socket binding even with all subordinate flags enabled', async () => {
    cfg.set('LIVE_V2_ENABLED', 'false');
    const socket = client();
    await gateway.handleConnection(socket);
    expect(socket.connected).toBe(false);
    expect(live.bindSocket).not.toHaveBeenCalled();
  });
  it('limits per-connection chat bursts before database writes', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    for (let i = 0; i < 21; i++)
      await gateway.message(socket, { message: 'test' });
    expect(live.socketMessage).toHaveBeenCalledTimes(20);
    expect(socket.connected).toBe(false);
  });
  it('stale socket messages are rejected before delivery', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    live.socketMessage.mockRejectedValue(new Error('stale generation'));
    await gateway.message(socket, { message: 'question' });
    expect(
      socket.emit.mock.calls.filter(([name]: any) => name === 'live:message'),
    ).toHaveLength(0);
    expect(socket.connected).toBe(false);
  });
  it('message recipients are revalidated and stale recipients are removed', async () => {
    const sender = client();
    await gateway.handleConnection(sender);
    const second = client();
    payload.connectionId = randomUUID();
    second.handshake.auth.connectionId = payload.connectionId;
    binding = { ...binding, connectionId: payload.connectionId };
    await gateway.handleConnection(second);
    live.socketAccess.mockImplementation(async (_actor: any, b: any) => {
      if (b.connectionId === payload.connectionId) throw new Error('stale');
      return b;
    });
    await gateway.message(sender, { message: 'question' });
    expect(sender.emit).toHaveBeenCalledWith(
      'live:message',
      expect.objectContaining({ message: 'question' }),
    );
    expect(second.connected).toBe(false);
  });
  it('heartbeat identity comes exclusively from the server binding', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    await gateway.heartbeat(socket, {});
    expect(live.socketHeartbeat).toHaveBeenCalledWith(actor, binding);
    await gateway.heartbeat(socket, { userId: 'foreign' });
    expect(socket.connected).toBe(false);
  });
  it('committed ended event is delivered to the matching Live session then disconnects', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    const event: LiveEndedEvent = {
      eventId: 'event',
      sessionId: 'session',
      status: 'ENDED',
      endedAt: new Date(),
      reason: 'EXPLICIT_END',
    };
    await events.publish(event);
    expect(socket.emit).toHaveBeenCalledWith('live:ended', event);
    expect(socket.connected).toBe(false);
  });
  it('a pending room join cannot produce two same-generation bindings', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = client();
    first.join.mockImplementation(() => pending);
    const firstTask = gateway.handleConnection(first);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    const second = client();
    await gateway.handleConnection(second);
    finish();
    await firstTask;
    expect(first.connected).toBe(true);
    expect(second.connected).toBe(false);
  });
});

describe('Live v2 worker activation and overlap guard', () => {
  it('does not query when disabled', async () => {
    const live: any = { sweepLeases: jest.fn() };
    const worker = new LiveV2Worker(live, new ConfigService());
    await worker.tick();
    expect(live.sweepLeases).not.toHaveBeenCalled();
  });
  it('prevents overlapping local sweeps and permits a later tick', async () => {
    let finish!: (result: any) => void;
    const live: any = {
      sweepLeases: jest.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    };
    const worker = new LiveV2Worker(
      live,
      new ConfigService({
        LIVE_V2_ENABLED: 'true',
        LIVE_V2_SOCKET_SINGLE_INSTANCE: 'true',
        LIVE_V2_MAINTENANCE_ENABLED: 'true',
      }),
    );
    const first = worker.tick();
    await worker.tick();
    expect(live.sweepLeases).toHaveBeenCalledTimes(1);
    finish({ failures: 0 });
    await first;
    live.sweepLeases.mockResolvedValue({ failures: 0 });
    await worker.tick();
    expect(live.sweepLeases).toHaveBeenCalledTimes(2);
  });
});
