jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));
jest.mock('../../infrastructure/supabase/communication-auth.service', () => ({
  CommunicationAuthService: class {},
}));
jest.mock('../user/user.service', () => ({ UserService: class {} }));
jest.mock('../../common/auth/admin-identity-policy', () => ({
  bindAdminRequest: jest.fn(),
}));
import { getMessaging } from 'firebase-admin/messaging';
import { bindAdminRequest } from '../../common/auth/admin-identity-policy';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsIdentityGuard } from './notifications-identity.guard';
import { NotificationsService } from './notifications.service';
import {
  assessNotificationActivation,
  NOTIFICATION_RELEASE_EVIDENCE,
} from './notification-activation-readiness';
import { smartDeliveryEnabled } from './smart-notifications.worker';

describe('notification requirements 57–64 security', () => {
  it.each(['true', 'invalid'])(
    'emergency switch blocks delivery, including malformed configuration: %s',
    (value) => {
      const prior = { ...process.env };
      try {
        process.env.SMART_NOTIFICATIONS_SCHEMA_READY = 'true';
        process.env.SMART_NOTIFICATIONS_DELIVERY_ENABLED = 'true';
        process.env.SMART_NOTIFICATIONS_POLICY_RELEASE_APPROVED = 'true';
        process.env.SMART_NOTIFICATIONS_EMERGENCY_DISABLED = value;
        expect(smartDeliveryEnabled()).toBe(false);
      } finally {
        process.env = prior;
      }
    },
  );
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });
  function sender() {
    const send = jest.fn().mockResolvedValue('accepted');
    (getMessaging as jest.Mock).mockReturnValue({ send });
    const db = {
      pushDevice: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'device', fcmToken: 'synthetic-token' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'device' }),
        updateMany: jest.fn(),
      },
    };
    const service = Object.assign(
      Object.create(NotificationsPushService.prototype),
      { prisma: db, firebaseApp: {}, logger: { warn: jest.fn() } },
    ) as NotificationsPushService;
    return { service, db, send };
  }
  it('stops a hung multi-device batch within its provider budget', async () => {
    jest.useFakeTimers();
    const { service, db, send } = sender();
    db.pushDevice.findMany.mockResolvedValue(Array.from({length: 4}, (_, index) => ({id: String(index), fcmToken: 'synthetic-' + index})));
    send.mockImplementation(() => new Promise(() => {}));
    const pending = service.sendToUser('owner', {title: 'Neutral', body: 'Open'});
    await jest.advanceTimersByTimeAsync(30_001);
    const result = await pending;
    expect(result.failed).toBe(4); expect(result.sent).toBe(0);
    expect(result.failureCodes).toContain('FCM_DEADLINE_UNKNOWN');
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('does not begin a provider send after a slow ownership lookup exhausted the budget', async () => {
    jest.useFakeTimers();
    const { service, db, send } = sender();
    db.pushDevice.findFirst.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({id: 'device'}), 31_000)));
    const pending = service.sendToUser('owner', {title: 'Neutral', body: 'Open'});
    await jest.advanceTimersByTimeAsync(31_001);
    expect((await pending).failureCodes).toEqual(['FCM_DEADLINE_UNKNOWN']);
    expect(send).not.toHaveBeenCalled();
  });
  it('binds outgoing payload to canonical owner and checks active ownership twice', async () => {
    const { service, db, send } = sender();
    await service.sendToUser('owner', {
      title: 'Neutral',
      body: 'Open securely',
      data: { ownerId: 'spoof' },
    });
    expect(send.mock.calls[0][0].data.ownerId).toBe('owner');
    for (const fn of [db.pushDevice.findMany, db.pushDevice.findFirst])
      expect(fn.mock.calls[0][0].where).toMatchObject({
        userId: 'owner',
        isActive: true,
        user: { is: { isActive: true, isBlocked: false } },
      });
  });
  it('does not send to reassigned, disabled or revoked devices', async () => {
    const { service, db, send } = sender();
    db.pushDevice.findFirst.mockResolvedValue(null);
    expect(
      (await service.sendToUser('owner', { title: 'Neutral', body: 'Open' }))
        .failureCodes,
    ).toEqual(['DEVICE_OWNERSHIP_CHANGED']);
    expect(send).not.toHaveBeenCalled();
  });
  it('does not send expired entitlement', async () => {
    const { service, send } = sender();
    await service.sendToUser('owner', {
      title: 'Neutral',
      body: 'Open',
      expiresAt: new Date(0),
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('bounds hung provider calls, reports UNKNOWN and never retries or disables token', async () => {
    jest.useFakeTimers();
    const { service, db, send } = sender();
    send.mockImplementation(() => new Promise(() => {}));
    const result = service.sendToUser('owner', {
      title: 'Neutral',
      body: 'Open',
    });
    await jest.advanceTimersByTimeAsync(10_001);
    expect((await result).failureCodes).toEqual(['FCM_TIMEOUT_UNKNOWN']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.pushDevice.updateMany).not.toHaveBeenCalled();
  });
  it('redacts unexpected provider messages and metadata', async () => {
    const { service, send } = sender();
    send.mockRejectedValue({ code: 'secret-token', message: 'private-url' });
    const result = await service.sendToUser('owner', {
      title: 'Neutral',
      body: 'Open',
    });
    expect(result.failureCodes).toEqual(['FCM_UNKNOWN']);
    expect(JSON.stringify(result)).not.toMatch(/secret-token|private-url/);
  });
  it('invalid-token cleanup is conditional on the original owner and exact token', async () => {
    const { service, db, send } = sender();
    send.mockRejectedValue({ code: 'messaging/invalid-registration-token' });
    await service.sendToUser('owner', { title: 'Neutral', body: 'Open' });
    expect(db.pushDevice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'device',
        userId: 'owner',
        fcmToken: 'synthetic-token',
        isActive: true,
      },
      data: { isActive: false },
    });
  });
  function guard(header: unknown = 'Bearer synthetic') {
    const auth = {
      verify: jest
        .fn()
        .mockResolvedValue({
          asp_user_id: 'canonical',
          sub: 'subject',
          asp_account_role: 'CUSTOMER',
          exp: Date.now() / 1000 + 100,
        }),
    };
    const request = { headers: { authorization: header } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) };
    return {
      auth,
      request,
      context,
      guard: new NotificationsIdentityGuard(auth as never, {} as never),
    };
  }
  it.each([undefined, '', 'Basic secret', 'Bearer ', 'Bearer local-dev'])(
    'rejects unauthorized header %s before verification',
    async (header) => {
      const x = guard(header === undefined ? null : header);
      await expect(x.guard.canActivate(x.context as never)).rejects.toThrow();
      expect(x.auth.verify).not.toHaveBeenCalled();
    },
  );
  it.each(['FIREBASE', 'SUPABASE'])(
    'uses shared readonly canonical verifier for %s',
    async () => {
      const x = guard();
      await expect(x.guard.canActivate(x.context as never)).resolves.toBe(true);
      expect(x.request).toHaveProperty('user.asp_user_id', 'canonical');
      expect(x.auth.verify).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['asp_user_id', 'sub', 'exp'])(
    'rejects missing canonical proof %s',
    async (field) => {
      const x = guard();
      x.auth.verify.mockResolvedValue({
        ...(await x.auth.verify()),
        [field]: undefined,
      });
      await expect(x.guard.canActivate(x.context as never)).rejects.toThrow();
    },
  );
  it('rejects revoked credentials without account synchronization', async () => {
    const x = guard();
    x.auth.verify.mockRejectedValue(new Error('revoked'));
    await expect(x.guard.canActivate(x.context as never)).rejects.toThrow();
    expect(x.request).not.toHaveProperty('user');
  });
  it('retains sole-Admin Google proof', async () => {
    const x = guard();
    x.auth.verify.mockResolvedValue({
      ...(await x.auth.verify()),
      asp_account_role: 'ADMIN',
    });
    await x.guard.canActivate(x.context as never);
    expect(bindAdminRequest).toHaveBeenCalledWith(
      x.request,
      'synthetic',
      expect.anything(),
    );
  });
  it.each([
    { fcmToken: ' ', platform: 'ANDROID' },
    { fcmToken: 'x'.repeat(4097), platform: 'ANDROID' },
    { fcmToken: 'x', platform: 'WRONG' },
    { fcmToken: 'x', platform: 'IOS', deviceId: 'x'.repeat(257) },
  ])('rejects malformed registration before database lookup', async (input) => {
    const service = new NotificationsService({} as never);
    await expect(
      service.registerDevice({ externalUserId: 'subject', ...input } as never),
    ).rejects.toThrow('Invalid notification device');
  });
  it('default-off readiness requires external evidence and cannot activate', () => {
    expect(assessNotificationActivation({})).toMatchObject({
      status: 'BLOCKED',
      activated: false,
    });
    const evidence = Object.fromEntries(
      NOTIFICATION_RELEASE_EVIDENCE.map((key) => [key, true]),
    );
    expect(assessNotificationActivation({}, evidence)).toMatchObject({
      status: 'PREPARED_NOT_ACTIVATED',
      activated: false,
      evidenceIndependentlyVerified: false,
    });
  });
  it.each(['true', 'invalid'])(
    'blocks active or malformed flags without printing values: %s',
    (value) => {
      const result = assessNotificationActivation({
        SMART_NOTIFICATIONS_DELIVERY_ENABLED: value,
      });
      expect(result.status).toBe('BLOCKED');
      expect(result.blockers.join()).not.toContain('invalid');
    },
  );
});
