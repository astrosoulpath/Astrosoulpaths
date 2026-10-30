import { getMessaging } from 'firebase-admin/messaging';
import { NotificationsPushService } from './notifications.push.service';
import { expiryPushEnabled } from './subscription-expiry.policy';

jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));

describe('explicit staging FCM deny gate', () => {
  const keys = ['FCM_SENDS_DISABLED', 'SUBSCRIPTION_EXPIRY_SCHEMA_READY', 'SUBSCRIPTION_EXPIRY_SCHEDULER_ENABLED', 'SUBSCRIPTION_EXPIRY_PUSH_ENABLED', 'SUBSCRIPTION_EXPIRY_POLICY_APPROVED'];
  let saved: Record<string, string | undefined>;
  let service: NotificationsPushService;
  let findMany: jest.Mock;
  beforeEach(() => {
    saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    process.env.FCM_SENDS_DISABLED = 'true';
    findMany = jest.fn();
    // Never initialize a real Firebase app or contact a database/provider.
    service = Object.create(NotificationsPushService.prototype) as NotificationsPushService;
    Reflect.set(service, 'prisma', { pushDevice: { findMany } });
    Reflect.set(service, 'firebaseApp', { name: 'synthetic-only' });
    jest.clearAllMocks();
  });
  afterEach(() => { for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  it('blocks legacy/direct sends before device lookup and does not report success', async () => {
    await expect(service.sendToUser('synthetic', { title: 'Test', body: 'Never send' })).resolves.toMatchObject({ success: false, sent: 0, failureCodes: ['DELIVERY_GATED'] });
    expect(findMany).not.toHaveBeenCalled();
    expect(getMessaging).not.toHaveBeenCalled();
  });
  it('blocks reminders even if their narrower feature gates are enabled', async () => {
    for (const key of keys.slice(1)) process.env[key] = 'true';
    expect(expiryPushEnabled()).toBe(true);
    await expect(service.sendSubscriptionReminder('synthetic', 'device', 'CUSTOMER', 'reminder', 'subscription', new Date(Date.now() + 60000))).resolves.toBe('DELIVERY_GATED');
    expect(getMessaging).not.toHaveBeenCalled();
  });
  it('also blocks when Firebase is unconfigured without querying devices', async () => {
    Reflect.set(service, 'firebaseApp', null);
    await expect(service.sendToUser('synthetic', { title: 'Test', body: 'Never send' })).resolves.toMatchObject({ success: false, configured: false, sent: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
