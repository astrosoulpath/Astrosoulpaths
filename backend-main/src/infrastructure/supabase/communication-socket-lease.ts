import type { JWTPayload } from 'jose';
import type { Socket } from 'socket.io';

/** A fail-closed receive lease: refresh at 25s, hard stop at 30s or token expiry. */
export function protectCommunicationSocket(
  socket: Socket,
  initial: JWTPayload,
  verify: () => Promise<JWTPayload>,
): void {
  let stopped = false;
  let refresh: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    stopped = true;
    clearTimeout(refresh);
    clearTimeout(deadline);
    socket.data.communicationAuthUntil = 0;
  };
  const reject = () => {
    if (stopped) return;
    cleanup();
    socket.emit('auth:required', { code: 'AUTH_REQUIRED' });
    socket.disconnect(true); // Socket.IO removes all private rooms.
  };
  const grant = (payload: JWTPayload) => {
    if (stopped) return;
    const remaining = Number(payload.exp) * 1000 - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return reject();
    clearTimeout(refresh);
    clearTimeout(deadline);
    const lifetime = Math.min(30_000, remaining);
    socket.data.communicationAuthUntil = Date.now() + lifetime;
    deadline = setTimeout(reject, lifetime);
    deadline.unref?.();
    if (remaining <= 25_000) return;
    refresh = setTimeout(() => {
      void verify().then((current) => {
        if (current.sub !== initial.sub ||
            current.asp_user_id !== initial.asp_user_id ||
            current.asp_account_role !== initial.asp_account_role) return reject();
        grant(current);
      }).catch(reject);
    }, 25_000);
    refresh.unref?.();
  };
  socket.once('disconnect', cleanup);
  grant(initial);
}
