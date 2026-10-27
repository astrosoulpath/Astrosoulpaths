import {
  horoscopeDailyDeliveryKey,
  horoscopeQuietHours,
  nextHoroscopeWindow,
} from './horoscope-delivery-policy';
import {
  horoscopeOutboxEnabled,
  HoroscopeDurableStore,
} from './horoscope-durable.store';
import { HoroscopeOutboxWorker } from './horoscope-outbox.worker';
import { notificationLocalDate } from '../notifications/notification-local-date';

describe('default-off proposed horoscope delivery policy (synthetic only)', () => {
  const original = { ...process.env };
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
    for (const key of [
      'HOROSCOPE_SCHEMA_READY',
      'HOROSCOPE_DURABLE_ENABLED',
      'HOROSCOPE_OUTBOX_ENABLED',
    ])
      process.env[key] = 'true';
    delete process.env.HOROSCOPE_REMINDER_POLICY_ENABLED;
  });
  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...original };
  });
  it('three old gates alone cannot enqueue or deliver without the new safety opt-in', async () => {
    expect(horoscopeOutboxEnabled()).toBe(false);
    const db: any = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    await new HoroscopeOutboxWorker(db, {} as never).tick();
    await expect(
      new HoroscopeDurableStore(db).enqueue(
        {} as never,
        ['device'],
        new Date(),
      ),
    ).rejects.toThrow('not activated');
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it.each([
    ['2026-10-21T07:59:00Z', true],
    ['2026-10-21T08:00:00Z', false],
    ['2026-10-21T21:59:00Z', false],
    ['2026-10-21T22:00:00Z', true],
  ])('UTC boundary %s is quiet=%s', (at, quiet) => {
    expect(horoscopeQuietHours('UTC', new Date(at as string))).toBe(quiet);
  });
  it.each([
    ['America/New_York', '2026-03-08T11:59:00Z', '2026-03-08T12:00:00Z'],
    ['America/New_York', '2026-11-01T03:30:00Z', '2026-11-01T13:00:00Z'],
    ['Asia/Kolkata', '2026-10-21T01:00:00Z', '2026-10-21T02:30:00Z'],
  ])('next window respects %s and DST', (zone, at, expected) => {
    expect(nextHoroscopeWindow(zone, new Date(at)).toISOString()).toBe(
      new Date(expected).toISOString(),
    );
  });
  it('invalid timezones fail closed', () => {
    expect(() => horoscopeQuietHours('Not/AZone')).toThrow();
  });
  it.each(['false', 'TRUE', '1'])(
    'non-explicit policy value %s stays disabled',
    (value) => {
      process.env.HOROSCOPE_REMINDER_POLICY_ENABLED = value;
      expect(horoscopeOutboxEnabled()).toBe(false);
    },
  );
  it('customer/day key ignores devices/locales but isolates accounts and dates', () => {
    expect(horoscopeDailyDeliveryKey('customer', '2026-10-21')).toBe(
      horoscopeDailyDeliveryKey('customer', '2026-10-21'),
    );
    expect(horoscopeDailyDeliveryKey('other', '2026-10-21')).not.toBe(
      horoscopeDailyDeliveryKey('customer', '2026-10-21'),
    );
    expect(horoscopeDailyDeliveryKey('customer', '2026-10-22')).not.toBe(
      horoscopeDailyDeliveryKey('customer', '2026-10-21'),
    );
  });
  it('only one deterministic device is enqueued with a customer/day UNIQUE key', async () => {
    process.env.HOROSCOPE_REMINDER_POLICY_ENABLED = 'true';
    const db: any = { $executeRaw: jest.fn().mockResolvedValue(1) };
    await new HoroscopeDurableStore(db).enqueue(
      {
        userId: 'customer',
        subscriptionId: 'sub',
        id: 'reading',
        localDate: '2026-10-21',
        locale: 'en',
      } as never,
      ['z', 'a', 'a'],
      new Date(),
    );
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const call = db.$executeRaw.mock.calls[0];
    expect(call).toContain('a');
    expect(call).not.toContain('z');
    expect(call[1]).toBe(horoscopeDailyDeliveryKey('customer', '2026-10-21'));
    expect(call[0].join('')).not.toContain('AND "deviceId"=');
  });
  function fixture(at: string) {
    jest.setSystemTime(new Date(at));
    const day = notificationLocalDate('UTC');
    const db: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          {
            response: {
              data: {
                ai: {
                  notificationTitle: 'Daily reflection',
                  shortReading: 'Take time to reflect today.',
                },
              },
            },
            localDate: day,
            timezone: 'UTC',
          },
        ]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const push: any = { sendToUser: jest.fn() };
    return {
      db,
      push,
      worker: new HoroscopeOutboxWorker(db, push) as any,
      job: {
        id: 'job',
        userId: 'customer',
        readingId: 'reading',
        locale: 'en',
        attempts: 1,
        leaseToken: 'lease',
      },
    };
  }
  it('before-08 retries wait for 08 without contacting a provider', async () => {
    const f = fixture('2026-10-21T07:00:00Z');
    await f.worker.deliver(f.job);
    expect(f.push.sendToUser).not.toHaveBeenCalled();
    expect(f.db.$executeRaw.mock.calls[0]).toContain('QUIET_HOURS');
    expect(f.db.$executeRaw.mock.calls[0][4].toISOString()).toBe(
      '2026-10-21T08:00:00.000Z',
    );
  });
  it('after-22 readings are cancelled rather than replayed on the next day', async () => {
    const f = fixture('2026-10-21T22:01:00Z');
    await f.worker.deliver(f.job);
    expect(f.push.sendToUser).not.toHaveBeenCalled();
    expect(f.db.$executeRaw.mock.calls[0]).toContain('QUIET_WINDOW_CLOSED');
    expect(f.db.$executeRaw.mock.calls[0]).toContain('CANCELLED');
  });
});
