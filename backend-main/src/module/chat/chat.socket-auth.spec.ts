jest.mock('../../infrastructure/supabase/supabase-jwt.service', () => ({
  SupabaseJwtService: jest.fn(),
}));
import { ChatGateway } from './chat.gateway';

describe('chat event authentication fencing (mock sockets)', () => {
  let gateway: any, auth: any, chat: any, client: any;
  beforeEach(() => {
    auth = {
      protectSocket: jest.fn(),
      verify: jest
        .fn()
        .mockResolvedValue({
          sub: 'canonical-subject',
          asp_user_id: 'canonical',
          exp: 9999999999,
        }),
    };
    chat = {
      joinChat: jest
        .fn()
        .mockResolvedValue({
          data: {
            roomId: 'session',
            currentUser: { id: 'canonical', name: 'Owner' },
          },
        }),
      sendMessage: jest.fn(),
    };
    gateway = new ChatGateway(chat, {} as any, auth);
    gateway.server = {
      in: () => ({ fetchSockets: async () => [] }),
      to: () => ({ emit: jest.fn() }),
    };
    client = {
      id: 'socket',
      handshake: { auth: { token: 'mock-token' }, headers: {} },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      to: () => ({ emit: jest.fn() }),
    };
  });
  it('connects and joins only with current canonical verification', async () => {
    await gateway.handleConnection(client);
    expect(auth.protectSocket).toHaveBeenCalledWith(client, expect.objectContaining({ sub: 'canonical-subject' }));
    await gateway.handleJoin(client, { callSessionId: 'session' });
    expect(chat.joinChat).toHaveBeenCalledWith(
      'canonical-subject',
      expect.objectContaining({ callSessionId: 'session' }),
    );
    expect(auth.verify).toHaveBeenCalledTimes(2);
    expect(client.join).toHaveBeenCalledWith('session');
  });
  it('revoked/expired credentials cannot send after an earlier successful connection', async () => {
    await gateway.handleConnection(client);
    auth.verify.mockRejectedValue(new Error('mock revoked'));
    await gateway.handleMessage(client, { callSessionId: 'session' });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('auth:required', {
      code: 'AUTH_REQUIRED',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it('rejects account switching on an existing socket', async () => {
    await gateway.handleConnection(client);
    auth.verify.mockResolvedValue({ sub: 'foreign' });
    await gateway.handleJoin(client, { callSessionId: 'session' });
    expect(chat.joinChat).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it('invalid handshake fails closed without joining', async () => {
    auth.verify.mockRejectedValue(new Error());
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(chat.joinChat).not.toHaveBeenCalled();
  });
});
