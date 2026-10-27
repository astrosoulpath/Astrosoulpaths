import {
  HoroscopeDurableStore,
  durableHoroscopeEnabled,
  readingIdentity,
  HOROSCOPE_CONTENT_VERSION,
} from './horoscope-durable.store';
import { HoroscopeOutboxWorker } from './horoscope-outbox.worker';
import { ACTIVATION_COPY, HOROSCOPE_LOCALES } from './horoscope-localization';
import { SubscriptionService } from './subscription.service';
import { NotificationsService } from '../notifications/notifications.service';
import {horoscopeReminderCopy} from './horoscope-reminder-copy';

describe('durable horoscope and outbox (mock/in-memory, NOT PostgreSQL)', () => {
  const original = { ...process.env };
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-21T12:00:00Z') });
    process.env.HOROSCOPE_DURABLE_ENABLED = 'true';
    process.env.HOROSCOPE_SCHEMA_READY = 'true';
    process.env.HOROSCOPE_OUTBOX_ENABLED = 'true';
    process.env.HOROSCOPE_REMINDER_POLICY_ENABLED = 'true';
  });
  afterEach(() => {
    jest.useRealTimers();
    process.env = { ...original };
  });
  const context = {
    userId: 'customer',
    subscriptionId: 'subscription',
    localDate: '2026-10-16',
    locale: 'en',
    timezone: 'Asia/Kolkata',
    profileFingerprint: 'synthetic-fingerprint',
  };
  function response(locale = 'en') {
    const [title, body] =
      ACTIVATION_COPY[locale as keyof typeof ACTIVATION_COPY];
    return {
      data: {
        generation: {
          language: { code: locale },
          contentVersion: HOROSCOPE_CONTENT_VERSION,
        },
        ai: { notificationTitle: title, shortReading: body, dailyAdvice: body },
      },
    };
  }
  it('disabled rollout does not access new tables', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    expect(durableHoroscopeEnabled()).toBe(false);
    const db: any = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    await expect(
      new HoroscopeDurableStore(db).generate(context, jest.fn()),
    ).rejects.toThrow('not activated');
    await new HoroscopeOutboxWorker(db, {} as any).tick();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it.each(HOROSCOPE_LOCALES)(
    '%s uses unique user/date/locale/version identity and retains locale on durable enqueue',
    async (locale) => {
      const c = { ...context, locale };
      expect(readingIdentity(c)).not.toBe(
        readingIdentity({ ...c, userId: 'other-customer' }),
      );
      expect(readingIdentity(c)).not.toBe(
        readingIdentity({ ...c, localDate: '2026-10-17' }),
      );
      if (locale !== 'en')
        expect(readingIdentity(c)).not.toBe(readingIdentity(context));
      const db: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: readingIdentity(c) }]),
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      const store = new HoroscopeDurableStore(db);
      const reading = await store.generate(c, async () => response(locale));
      expect(reading.locale).toBe(locale);
      await store.enqueue(reading, ['device', 'device'], new Date(0));
      expect(db.$executeRaw).toHaveBeenCalledTimes(2); // READY update + one unique device insert.
      expect(db.$executeRaw.mock.calls[1]).toContain(locale);
    },
  );
  it('READY reading avoids another AI call; changed profile fails closed rather than reusing stale content', async () => {
    const db: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValue([
          {
            ...context,
            id: readingIdentity(context),
            state: 'READY',
            response: response(),
          },
        ]),
      $executeRaw: jest.fn(),
    };
    const generate = jest.fn();
    await new HoroscopeDurableStore(db).generate(context, generate);
    expect(generate).not.toHaveBeenCalled();
    db.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...context, state: 'READY' }]);
    await expect(
      new HoroscopeDurableStore(db).generate(
        { ...context, profileFingerprint: 'changed' },
        generate,
      ),
    ).rejects.toThrow('profile-version');
  });
  it('lost generation lease cannot persist a response or erase another owner', async () => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'claim' }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
    };
    await expect(
      new HoroscopeDurableStore(db).generate(context, async () => response()),
    ).rejects.toThrow('unavailable');
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain(
      '"leaseUntil">CURRENT_TIMESTAMP',
    );
    expect(db.$executeRaw.mock.calls[1][0].join('')).toContain('"leaseToken"=');
  });
  it('wrong locale is FAILED, not READY', async () => {
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'claim' }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    await expect(
      new HoroscopeDurableStore(db).generate(context, async () =>
        response('ja'),
      ),
    ).rejects.toThrow();
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain("'FAILED'");
  });

  function fixture(locale = 'en') {
    const row: any = {
      id: 'job',
      userId: 'customer',
      subscriptionId: 'subscription',
      readingId: 'reading',
      deviceId: 'device',
      locale,
      attempts: 0,
      state: 'QUEUED',
      expired: false,
    };
    const db: any = {
      subscription: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ endDate: new Date(Date.now() + 86400000) }),
      },
      pushDevice: { findFirst: jest.fn().mockResolvedValue({ id: 'device' }) },
    };
    db.$queryRaw = jest.fn(
      async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join('');
        if (sql.includes('WITH candidates')) {
          if (
            row.attempts >= 5 ||
            !(
              ['QUEUED', 'RETRY'].includes(row.state) ||
              (row.state === 'PROCESSING' && row.expired)
            )
          )
            return [];
          row.state = 'PROCESSING';
          row.expired = false;
          row.attempts++;
          row.leaseToken = values[0];
          return [{ ...row }];
        }
        if (sql.includes('HoroscopeNotificationPreference'))
          return [{ enabled: true }];
        return [{ response: response(locale), localDate: row.readingDay ?? new Date().toISOString().slice(0,10), timezone:'UTC' }];
      },
    );
    db.$executeRaw = jest.fn(
      async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join('');
        if (sql.includes("'MAX_ATTEMPTS'")) {
          if (row.state === 'PROCESSING' && row.expired && row.attempts >= 5)
            row.state = 'FAILED';
          return 0;
        }
        if (sql.includes("'ACCEPTANCE_UNKNOWN'")) {
          if (row.state === 'SENDING' && row.expired) row.state = 'UNKNOWN';
          return 0;
        }
        if (sql.includes('SET "state"=') && values.length >= 7) {
          if (
            row.leaseToken !== values[6] ||
            row.expired ||
            !['PROCESSING', 'SENDING'].includes(row.state)
          )
            return 0;
          row.state = values[0];
          row.failureCode = values[1];
          row.nextAttemptAt = values[3];
          row.leaseToken = null;
          return 1;
        }
        if (sql.includes('SET "state"=\'SENDING\'')) {
          if (
            row.state !== 'PROCESSING' ||
            row.leaseToken !== values[1] ||
            row.expired
          )
            return 0;
          row.state = 'SENDING';
          return 1;
        }
        return 0;
      },
    );
    const push: any = {
      sendToUser: jest
        .fn()
        .mockResolvedValue({ sent: 1, failed: 0, configured: true }),
    };
    return { row, db, push, worker: new HoroscopeOutboxWorker(db, push) };
  }
  it('concurrent workers and later restarts do not resend accepted per-device jobs', async () => {
    const f = fixture();
    await Promise.all([f.worker.tick(), f.worker.tick()]);
    await f.worker.tick();
    expect(f.push.sendToUser).toHaveBeenCalledTimes(1);
    expect(f.row.state).toBe('ACCEPTED');
    expect(f.push.sendToUser.mock.calls[0][2]).toBe('device');
  });
  it('crash after SENDING becomes UNKNOWN without automatic resend', async () => {
    const f = fixture();
    f.row.state = 'SENDING';
    f.row.expired = true;
    await f.worker.tick();
    expect(f.row.state).toBe('UNKNOWN');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
  });
  it('crash before SENDING reclaims expired processing lease', async () => {
    const f = fixture();
    f.row.state = 'PROCESSING';
    f.row.expired = true;
    await f.worker.tick();
    expect(f.row.state).toBe('ACCEPTED');
    expect(f.row.attempts).toBe(1);
  });
  it('known transient FCM rejection schedules bounded retry without changing language', async () => {
    const f = fixture();
    f.push.sendToUser.mockResolvedValue({
      sent: 0,
      failed: 1,
      configured: true,
      failureCodes: ['messaging/quota-exceeded'],
    });
    await f.worker.tick();
    expect(f.row.state).toBe('RETRY');
    expect(f.row.locale).toBe('en');
    expect(f.row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    f.row.attempts = 4;
    await f.worker.tick();
    expect(f.row.state).toBe('FAILED');
  });
  it.each(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])(
    'known permanent device rejection %s is terminal, not acceptance-UNKNOWN', async (code) => {
      const f = fixture();
      f.push.sendToUser.mockResolvedValue({sent:0,failed:1,configured:true,failureCodes:[code]});
      await f.worker.tick();
      expect(f.row.state).toBe('FAILED');
      expect(f.row.failureCode).toBe('FCM_DEVICE_INVALID');
      await f.worker.tick();
      expect(f.push.sendToUser).toHaveBeenCalledTimes(1);
    },
  );
  it('expired local-day content is cancelled before provider delivery', async () => {
    const f = fixture();f.row.readingDay='2000-01-01';
    await f.worker.tick();expect(f.row.state).toBe('CANCELLED');
    expect(f.row.failureCode).toBe('READING_EXPIRED');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
  });
  it('saved language change cancels a stale locale job at the delivery boundary', async () => {
    const f = fixture('en');
    f.db.subscription.findFirst.mockImplementation(async (query: any) =>
      query.where.user.userProfile.lang.equals === 'hi' ? {endDate:new Date(Date.now()+60000)} : null);
    await f.worker.tick();
    expect(f.row.state).toBe('CANCELLED');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
  });
  it('a changed current timezone cannot receive a reading using the old quiet-hours window', async () => {
    const f = fixture();
    f.db.subscription.findFirst.mockImplementation(async (query: any) =>
      query.where.user.userProfile.timezoneName === 'Asia/Tokyo'
        ? { endDate: new Date(Date.now() + 60000) } : null);
    await f.worker.tick();
    expect(f.db.subscription.findFirst.mock.calls[0][0].where.user.userProfile.timezoneName).toBe('UTC');
    expect(f.row.state).toBe('CANCELLED');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
  });
  it('expired entitlement and disabled device cannot receive premium content', async () => {
    const f = fixture();
    f.db.subscription.findFirst.mockResolvedValue(null);
    await f.worker.tick();
    expect(f.row.state).toBe('CANCELLED');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
    const other = fixture();
    other.db.pushDevice.findFirst.mockResolvedValue(null);
    await other.worker.tick();
    expect(other.row.state).toBe('CANCELLED');
    expect(other.push.sendToUser).not.toHaveBeenCalled();
  });
  it('preference defaults off without database reads before activation', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    const db: any = { $queryRaw: jest.fn() };
    expect(
      (await new NotificationsService(db).getHoroscopePreference('subject'))
        .data.enabled,
    ).toBe(false);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('period-end cancellation remains blocked pre-migration', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    const db: any = { user: { findUnique: jest.fn() } };
    await expect(
      new SubscriptionService(db).cancelSubscription('subject', {
        cancelAtPeriodEnd: true,
      }),
    ).rejects.toThrow('not supported');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it.each(HOROSCOPE_LOCALES)(
    '%s preserves notification content through a known-rejection retry',
    async (locale) => {
      const f = fixture(locale);
      f.push.sendToUser.mockResolvedValueOnce({
        sent: 0,
        failed: 1,
        configured: true,
        failureCodes: ['messaging/quota-exceeded'],
      });
      await f.worker.tick();
      await f.worker.tick();
      expect(f.row.state).toBe('ACCEPTED');
      const {title,body}=horoscopeReminderCopy(locale);
      for (const call of f.push.sendToUser.mock.calls) {
        expect(call[1].title).toBe(title);
        expect(call[1].body).toBe(body);
        expect(call[1].data.locale).toBe(locale);
      }
    },
  );
  it('ambiguous provider failure is UNKNOWN, never automatically resent', async () => {
    const f = fixture();
    f.push.sendToUser.mockRejectedValue(new Error('private provider error'));
    await f.worker.tick();
    await f.worker.tick();
    expect(f.row.state).toBe('UNKNOWN');
    expect(f.push.sendToUser).toHaveBeenCalledTimes(1);
  });
  it('missing explicit preference cancels delivery', async () => {
    const f = fixture();
    const originalQuery = f.db.$queryRaw;
    f.db.$queryRaw = jest.fn(
      (strings: TemplateStringsArray, ...values: any[]) =>
        strings.join('').includes('HoroscopeNotificationPreference')
          ? []
          : originalQuery(strings, ...values),
    );
    await f.worker.tick();
    expect(f.row.state).toBe('CANCELLED');
    expect(f.push.sendToUser).not.toHaveBeenCalled();
  });
  function cancellation(provider = false, changed = 1) {
    const subscription = {
      id: 'subscription',
      userId: 'customer',
      subscriptionPlanId: 'daily',
      subscriptionStatus: 'ACTIVE',
      endDate: new Date(Date.now() + 86400000),
      razorpaySubscriptionId: provider ? 'mandate' : null,
    };
    const tx: any = {
      subscription: { findFirst: jest.fn().mockResolvedValue(subscription) },
      subscriptionPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'DAILY_HOROSCOPE_MONTHLY' }),
      },
      $executeRaw: jest.fn().mockResolvedValue(changed),
    };
    const db: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'customer' }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(subscription),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    return { db, tx, service: new SubscriptionService(db) };
  }
  it('manual period-end cancellation persists control and audit atomically without ending paid access', async () => {
    const f = cancellation();
    const result = await f.service.cancelSubscription('subject', {
      cancelAtPeriodEnd: true,
    });
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(f.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(f.db.subscription.update).not.toHaveBeenCalled();
    expect(f.db.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'Serializable',
    });
    expect(f.tx.subscription.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'subscription',
      userId: 'customer',
      subscriptionStatus: 'ACTIVE',
    });
  });
  it('repeated cancellation does not duplicate the audit', async () => {
    const f = cancellation(false, 0);
    await f.service.cancelSubscription('subject', { cancelAtPeriodEnd: true });
    expect(f.tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('provider-backed mandate cannot receive a false local cancellation promise', async () => {
    const f = cancellation(true);
    await expect(
      f.service.cancelSubscription('subject', { cancelAtPeriodEnd: true }),
    ).rejects.toThrow('Provider mandate');
    expect(f.tx.$executeRaw).not.toHaveBeenCalled();
  });
  it('expired ACTIVE rows are presented as expired without changing history', async () => {
    const db: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'customer' }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          subscriptionStatus: 'ACTIVE',
          endDate: new Date(0),
          subscriptionPlan: { name: 'DAILY_HOROSCOPE_MONTHLY' },
        }),
        update: jest.fn(),
      },
    };
    db.$queryRaw = jest.fn().mockResolvedValue([{ cancelAtPeriodEnd: true }]);
    const result = await new SubscriptionService(db).getCurrentSubscription(
      'subject',
    );
    expect(result.data?.subscriptionStatus).toBe('EXPIRED');
    expect(result.billing?.automaticRenewalSupported).toBe(false);
    expect(db.subscription.update).not.toHaveBeenCalled();
  });
});
