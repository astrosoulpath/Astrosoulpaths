jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({
  SupabaseJwtService: jest.fn(),
}));
import { CallService } from './call.service';
import { CallGateway } from './call.gateway';

describe('persisted call signalling authorization (mock database/sockets)', () => {
  let prisma: any, service: CallService, call: any;
  beforeEach(() => {
    call = {
      id: 'call',
      userId: 'customer',
      astrologerId: 'astro',
      status: 'PENDING',
      mode: 'audio',
      endedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { name: 'Real Customer', isActive: true, isBlocked: false },
      astrologer: {
        isActive: true,
        isBlocked: false,
        isAstrologer: true,
        astrologer: { isApproved: true, isVerified: true },
      },
    };
    prisma = {
      callSession: {
        findUnique: jest.fn().mockImplementation(async () => call),
      },
    };
    service = new CallService(prisma, {} as any);
  });
  it('authorizes real pending consultation with canonical caller name', async () => {
    expect(
      await service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO'),
    ).toEqual({ callerName: 'Real Customer' });
  });
  it('only acknowledges acceptance after persisted activation', async () => {
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO', 'ACCEPT')).rejects.toThrow();
    call.status = 'ACTIVE';
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO', 'ACCEPT')).resolves.toBeDefined();
  });
  it('allows assigned receiver rejection notification after HTTP rejection, without granting RTC access', async () => {
    call.status = 'REJECTED'; call.endedAt = new Date();
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO', 'REJECT')).resolves.toBeDefined();
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO')).rejects.toThrow();
    await expect(service.authorizeSignalling('call', 'foreign', 'astro', 'AUDIO', 'REJECT')).rejects.toThrow();
  });
  it('cancellation may acknowledge persisted cancellation but cannot override acceptance', async () => {
    call.status = 'CANCELLED'; call.endedAt = new Date();
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO', 'CANCEL')).resolves.toBeDefined();
    call.status = 'ACTIVE'; call.endedAt = null;
    await expect(service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO', 'CANCEL')).rejects.toThrow();
  });
  it.each(['ENDED', 'COMPLETED', 'REJECTED', 'CANCELLED'])(
    'rejects %s session',
    async (status) => {
      call.status = status;
      await expect(
        service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO'),
      ).rejects.toThrow();
    },
  );
  it.each([
    ['foreign', 'astro', 'AUDIO'],
    ['customer', 'foreign', 'AUDIO'],
    ['customer', 'astro', 'VIDEO'],
  ])('rejects participant or mode mismatch %s/%s/%s', async (a, b, m) => {
    await expect(
      service.authorizeSignalling('call', a, b, m as any),
    ).rejects.toThrow();
  });
  it('rejects expired and unapproved calls', async () => {
    call.expiresAt = new Date(0);
    await expect(
      service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO'),
    ).rejects.toThrow();
    call.expiresAt = new Date(Date.now() + 60000);
    call.astrologer.astrologer.isApproved = false;
    await expect(
      service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO'),
    ).rejects.toThrow();
  });
  it('rejects blocked participants and missing calls', async () => {
    call.user.isBlocked = true;
    await expect(
      service.authorizeSignalling('call', 'customer', 'astro', 'AUDIO'),
    ).rejects.toThrow();
    call = null;
    await expect(
      service.authorizeSignalling('missing', 'customer', 'astro', 'AUDIO'),
    ).rejects.toThrow();
  });

  describe('gateway', () => {
    let gateway: any, sockets: any, client: any, auth: any, signalling: any;
    beforeEach(() => {
      auth = { verify: jest.fn().mockResolvedValue({ sub: 'subject' }) };
      signalling = {
        resolveAuthenticatedUserId: jest.fn().mockResolvedValue('customer'),
        authorizeSignalling: jest
          .fn()
          .mockResolvedValue({ callerName: 'Real Customer' }),
      };
      sockets = {
        emitToUser: jest.fn().mockReturnValue(true),
        registerUser: jest.fn(),
        unregisterSocket: jest.fn(),
      };
      gateway = new CallGateway(sockets, signalling, auth);
      client = {
        id: 'socket',
        data: { callUserId: 'customer' },
        handshake: { auth: { token: 'fixture' }, headers: {} },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      gateway.registeredSocketUsers.set('socket', 'customer');
    });
    afterEach(() => {
      for (const c of gateway.ringingCalls.values()) clearTimeout(c.timeout);
    });
    const payload = {
      callId: 'call',
      callerId: 'customer',
      recipientUserId: 'astro',
      callerName: 'Spoofed',
    };
    async function receive() {
      await gateway.initiateCall(client, payload);
      client.data.callUserId = 'astro';
      gateway.registeredSocketUsers.set('socket', 'astro');
      signalling.resolveAuthenticatedUserId.mockResolvedValue('astro');
    }
    const response = { callId: 'call', callerUserId: 'customer', receiverUserId: 'astro' };
    it.each(['acceptCall', 'rejectCall'])('customer to astrologer %s is terminal and duplicate-safe', async action => {
      await receive();
      await gateway[action](client, response);
      const events = sockets.emitToUser.mock.calls.length;
      await gateway[action](client, response);
      expect(sockets.emitToUser.mock.calls.length).toBe(events);
      expect(gateway.ringingCalls.size).toBe(0);
    });
    it('timeout wins against a delayed accept without late accepted events', async () => {
      await receive();
      let release: (value: any) => void = () => {};
      signalling.authorizeSignalling.mockReturnValue(new Promise(resolve => release = resolve));
      const work = gateway.acceptCall(client, response);
      for (let i = 0; i < 8; i++) await Promise.resolve();
      gateway.handleMissedCall('call');
      release({ callerName: 'Customer' });
      await work;
      expect(sockets.emitToUser.mock.calls.filter(c => c[1] === 'call:accepted')).toHaveLength(0);
      expect(sockets.emitToUser.mock.calls.filter(c => c[1] === 'call:missed')).toHaveLength(2);
    });
    it('simultaneous receiver devices cannot both accept/reject', async () => {
      await receive();
      const other = { ...client, id: 'second', emit: jest.fn() };
      gateway.registeredSocketUsers.set('second', 'astro');
      await Promise.all([gateway.acceptCall(client, response), gateway.rejectCall(other, response)]);
      const terminal = sockets.emitToUser.mock.calls.filter(c => ['call:accepted','call:rejected'].includes(c[1]));
      expect(terminal).toHaveLength(2); // One terminal event, delivered to both participants.
      expect(new Set(terminal.map(c => c[1])).size).toBe(1);
    });
    it('duplicate customer devices do not ring twice', async () => {
      await Promise.all([gateway.initiateCall(client, payload), gateway.initiateCall(client, payload)]);
      expect(sockets.emitToUser.mock.calls.filter(c => c[1] === 'call:incoming')).toHaveLength(1);
    });
    it('stale cancellation after persisted acceptance cannot clear ringing', async () => {
      await gateway.initiateCall(client, payload);
      signalling.authorizeSignalling.mockRejectedValue(new Error());
      await gateway.cancelCall(client, { callId: 'call', callerUserId: 'customer', recipientUserId: 'astro' });
      expect(gateway.ringingCalls.has('call')).toBe(true);
      expect(sockets.emitToUser.mock.calls.filter(c => c[1] === 'call:cancelled')).toHaveLength(0);
    });
    it('simultaneous duplicate cancels emit one terminal event to each participant', async () => {
      await gateway.initiateCall(client, payload);
      const cancel = { callId: 'call', callerUserId: 'customer', recipientUserId: 'astro' };
      await Promise.all([gateway.cancelCall(client, cancel), gateway.cancelCall(client, cancel)]);
      expect(sockets.emitToUser.mock.calls.filter(c => c[1] === 'call:cancelled')).toHaveLength(2);
      expect(gateway.ringingCalls.size).toBe(0);
    });
    it('does not ring arbitrary persisted-ineligible recipients', async () => {
      signalling.authorizeSignalling.mockRejectedValue(new Error());
      await gateway.initiateCall(client, payload);
      expect(sockets.emitToUser).not.toHaveBeenCalled();
    });
    it('uses canonical name for valid ringing', async () => {
      await gateway.initiateCall(client, payload);
      expect(sockets.emitToUser).toHaveBeenCalledWith(
        'astro',
        'call:incoming',
        expect.objectContaining({ callerName: 'Real Customer' }),
      );
    });
    it.each(['acceptCall', 'rejectCall'])(
      'rechecks persisted eligibility for %s',
      async (action) => {
        client.data.callUserId = 'astro';
        gateway.registeredSocketUsers.set('socket', 'astro');
        signalling.resolveAuthenticatedUserId.mockResolvedValue('astro');
        gateway.ringingCalls.set('call', {
          callId: 'call',
          callerUserId: 'customer',
          recipientUserId: 'astro',
          consultationType: 'AUDIO',
          timeout: setTimeout(() => {}, 60000),
        });
        signalling.authorizeSignalling.mockRejectedValue(new Error());
        await gateway[action](client, {
          callId: 'call',
          callerUserId: 'customer',
          receiverUserId: 'astro',
        });
        expect(sockets.emitToUser).not.toHaveBeenCalled();
        expect(gateway.ringingCalls.has('call')).toBe(true);
      },
    );
    it('rejects revoked auth and disconnects before signalling', async () => {
      auth.verify.mockRejectedValue(new Error());
      await gateway.initiateCall(client, payload);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(signalling.authorizeSignalling).not.toHaveBeenCalled();
    });
    it('rejects changing socket identity', async () => {
      signalling.resolveAuthenticatedUserId.mockResolvedValue('foreign');
      await gateway.initiateCall(client, payload);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(sockets.emitToUser).not.toHaveBeenCalled();
    });
  });
});
