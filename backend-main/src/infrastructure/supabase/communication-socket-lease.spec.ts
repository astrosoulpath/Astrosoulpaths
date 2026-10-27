import { protectCommunicationSocket } from './communication-socket-lease';
import { CallSocketService } from '../../module/call/call-socket.service';

describe('bounded private socket receive leases', () => {
  let socket: any, payload: any, verify: jest.Mock;
  beforeEach(() => {
    jest.useFakeTimers();
    payload = { sub: 'canonical', asp_user_id: 'user', asp_account_role: 'CUSTOMER', exp: Date.now() / 1000 + 3600 };
    socket = { id: 'socket', connected: true, data: {}, once: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
    verify = jest.fn().mockResolvedValue(payload);
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it('disconnects an idle socket exactly at token expiry', async () => {
    payload.exp = Date.now() / 1000 + 10;
    protectCommunicationSocket(socket, payload, verify);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(verify).not.toHaveBeenCalled();
    expect(socket.data.communicationAuthUntil).toBe(0);
  });
  it.each(['revoked', 'disabled', 'logout'])('removes an idle %s socket after bounded revalidation', async () => {
    verify.mockRejectedValue(new Error('sanitized fixture'));
    protectCommunicationSocket(socket, payload, verify);
    await jest.advanceTimersByTimeAsync(25_000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.emit).toHaveBeenCalledWith('auth:required', { code: 'AUTH_REQUIRED' });
  });
  it('fails closed at the deadline when provider verification hangs', async () => {
    verify.mockReturnValue(new Promise(() => {}));
    protectCommunicationSocket(socket, payload, verify);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });
  it('refreshes a valid lease without verification per broadcast', async () => {
    protectCommunicationSocket(socket, payload, verify);
    const calls = new CallSocketService();
    calls.registerUser('user', socket);
    for (let i = 0; i < 10; i++) expect(calls.emitToUser('user', 'call:incoming', {})).toBe(true);
    expect(verify).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(26_000);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
  it('isolates recipients and excludes expired or unverified call sockets', () => {
    const calls = new CallSocketService();
    calls.registerUser('expired', socket);
    expect(calls.emitToUser('expired', 'call:incoming', {})).toBe(false);
    expect(calls.emitToSocket(socket.id, 'call:incoming', {})).toBe(false);
    protectCommunicationSocket(socket, payload, verify);
    calls.registerUser('owner', socket);
    expect(calls.emitToUser('foreign', 'call:incoming', {})).toBe(false);
    expect(calls.emitToUser('owner', 'call:incoming', {})).toBe(true);
  });
  it('rejects canonical identity or role changes', async () => {
    verify.mockResolvedValue({ ...payload, asp_account_role: 'ADMIN' });
    protectCommunicationSocket(socket, payload, verify);
    await jest.advanceTimersByTimeAsync(25_000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });
  it('disconnect cleanup cancels verification and prevents late regrant', async () => {
    let resolve: (v: any) => void = () => {};
    verify.mockReturnValue(new Promise(r => resolve = r));
    protectCommunicationSocket(socket, payload, verify);
    await jest.advanceTimersByTimeAsync(25_000);
    socket.once.mock.calls[0][1]();
    resolve(payload);
    await Promise.resolve();
    expect(socket.data.communicationAuthUntil).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
