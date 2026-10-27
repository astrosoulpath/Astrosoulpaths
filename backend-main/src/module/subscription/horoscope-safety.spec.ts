jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn() }));
jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));
import OpenAI from 'openai';
import { DailyHoroscopeAiService } from '../astro/modules/dailyinsight/daily-horoscope-ai.service';
import { getMessaging } from 'firebase-admin/messaging';
import { Prisma } from '@prisma/client';
import {
  ACTIVATION_COPY,
  HOROSCOPE_LOCALES,
  requireHoroscopeLocale,
  validateHoroscopeText,
} from './horoscope-localization';
import {
  assertDailyPlan,
  assertDailyCheckoutAvailable,
  exactPeriodEnd,
  DAILY_PLAN,
} from './daily-horoscope-policy';
import { DailyHoroscopePushProcessor } from '../astro/modules/dailyinsight/daily-horoscope-push.processor';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import {horoscopeReminderCopy} from './horoscope-reminder-copy';

describe('personalized horoscope safety (synthetic multilingual fixtures, not real AI)', () => {
  it.each([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
  ])(
    'invalid FCM token code %s deactivates only that synthetic device',
    async (code) => {
      (getMessaging as jest.Mock).mockReturnValue({
        send: jest.fn().mockRejectedValue({ code }),
      });
      const push: any = Object.create(NotificationsPushService.prototype);
      push.firebaseApp = {};
      push.logger = { warn: jest.fn() };
      push.prisma = {
        pushDevice: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'expired-device', fcmToken: 'synthetic-token' },
            ]),
          findFirst: jest.fn().mockResolvedValue({id:'expired-device'}),
          updateMany: jest.fn(),
        },
      };
      expect(
        (await push.sendToUser('customer', { title: 'Test', body: 'Test' }))
          .failed,
      ).toBe(1);
      expect(push.prisma.pushDevice.updateMany).toHaveBeenCalledWith({
        where: { id: 'expired-device',userId:'customer',fcmToken:'synthetic-token',isActive:true },
        data: { isActive: false },
      });
    },
  );
  it.each([
    ['Asia/Tokyo', '2026-10-16', 9],
    ['America/New_York', '2026-10-15', 20],
  ])('local date/time respects %s', (zone, date, hour) => {
    const processor: any = Object.create(DailyHoroscopePushProcessor.prototype);
    expect(
      processor.resolveLocalTime(new Date('2026-10-16T00:30:00Z'), zone, 0),
    ).toMatchObject({ date, hour });
  });
  it('requires exactly USD 1 for 30 days and preserves other plans', () => {
    const plan = {
      name: DAILY_PLAN,
      price: new Prisma.Decimal(1),
      currency: 'USD',
      durationDays: 30,
    };
    expect(() => assertDailyPlan(plan)).not.toThrow();
    for (const change of [
      { price: new Prisma.Decimal(2) },
      { currency: 'INR' },
      { durationDays: 31 },
    ])
      expect(() => assertDailyPlan({ ...plan, ...change })).toThrow();
    expect(() =>
      assertDailyPlan({
        ...plan,
        name: 'ASTROLOGER_KUNDLI_YEARLY',
        durationDays: 365,
      }),
    ).not.toThrow();
  });
  it('checkout is disabled by default without provider calls', () => {
    const old = process.env.PERSONALIZED_HOROSCOPE_PAYMENTS_ENABLED;
    delete process.env.PERSONALIZED_HOROSCOPE_PAYMENTS_ENABLED;
    try {
      expect(() => assertDailyCheckoutAvailable(DAILY_PLAN)).toThrow(
        'disabled',
      );
    } finally {
      if (old === undefined)
        delete process.env.PERSONALIZED_HOROSCOPE_PAYMENTS_ENABLED;
      else process.env.PERSONALIZED_HOROSCOPE_PAYMENTS_ENABLED = old;
    }
  });
  it.each([
    '2026-03-08T06:59:00Z',
    '2026-11-01T05:59:00Z',
    '2026-12-31T23:59:59Z',
  ])('uses 30 times 24 UTC hours at %s', (start) => {
    expect(
      exactPeriodEnd(new Date(start), 30).getTime() - new Date(start).getTime(),
    ).toBe(2592000000);
  });
  it('unknown locale, empty text and corrupt Unicode fail without English fallback', () => {
    expect(() => requireHoroscopeLocale('xx')).toThrow();
    expect(() => validateHoroscopeText('fr', [''])).toThrow();
    expect(() => validateHoroscopeText('ja', ['English horoscope'])).toThrow();
    expect(() => validateHoroscopeText('ar', ['\uFFFD'])).toThrow();
  });
  it.each(HOROSCOPE_LOCALES)(
    '%s Unicode fixture survives generation adapter, title/body and FCM serialization',
    async (locale) => {
      const [title, body] = ACTIVATION_COPY[locale];
      const aiFixture = {
        locale,
        notificationTitle: title,
        shortReading: body,
        dailyAdvice: body,
        generalGuidance: body,
        lifeAreas: {
          general: body,
          career: body,
          relationships: body,
          health: body,
          finance: body,
        },
        favorableActivities: [],
        cautionActivities: [],
        mood: '',
        focusArea: '',
        luckyColor: '',
        luckyNumber: null,
      };
      const create = jest.fn().mockResolvedValue({
        output_text: JSON.stringify(aiFixture),
        model: 'mock-model',
      });
      (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
        responses: { create },
      }));
      const oldKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'synthetic-not-a-real-key';
      try {
        const generated = await new DailyHoroscopeAiService().generate({
          name: 'Synthetic Customer',
          targetDate: '2026-10-16',
          requestedDay: 'today',
          languageCode: locale,
          languageName: locale,
          languageNativeName: locale,
          vedicData: { source: 'synthetic-fixture' },
        });
        expect(generated.notificationTitle).toBe(title);
        expect(create.mock.calls[0][0].input).toContain(
          `Requested language code: ${locale}`,
        );
      } finally {
        if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = oldKey;
      }
      validateHoroscopeText(locale, [title, body]);
      expect(Buffer.from(Buffer.from(body, 'utf8')).toString('utf8')).toBe(
        body,
      );
      const send = jest.fn().mockResolvedValue('mock-message');
      (getMessaging as jest.Mock).mockReturnValue({ send });
      const push: any = Object.create(NotificationsPushService.prototype);
      push.firebaseApp = {};
      push.prisma = {
        pushDevice: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'device', fcmToken: 'synthetic-token' }]),
          findFirst: jest.fn().mockResolvedValue({id:'device'}),
        },
      };
      const db: any = {
        subscription: {
          findMany: jest.fn().mockResolvedValue([
            {
              user: {
                id: 'customer',
                supabaseId: 'subject',
                userProfile: { lang: locale, timezoneName: 'Asia/Kolkata' },
              },
            },
          ]),
          findFirst: jest.fn().mockResolvedValue({ id: 'active' }),
        },
      };
      const redis: any = {
        get: jest.fn().mockResolvedValue(null),
        setNX: jest.fn().mockResolvedValue(true),
        set: jest.fn(),
        releaseLock: jest.fn(),
      };
      const generation: any = {
        getNakshatraDailyInsight: jest.fn().mockResolvedValue({
          data: {
            generation: { language: { code: locale } },
            ai: {
              notificationTitle: title,
              shortReading: body,
              dailyAdvice: body,
            },
          },
        }),
      };
      const notifications: any = {
        createForUser: jest.fn(async (x) => ({ id: 'notification', ...x })),
      };
      const processor = new DailyHoroscopePushProcessor(
        db,
        redis,
        generation,
        push,
        notifications,
      );
      jest
        .spyOn(processor as any, 'resolveLocalTime')
        .mockReturnValue({ date: '2026-10-16', hour: 8 });
      await processor.processDailyHoroscopePushes();
      expect(generation.getNakshatraDailyInsight).toHaveBeenCalledWith(
        'subject',
        'today',
        locale,
      );
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: horoscopeReminderCopy(locale),
          data: expect.objectContaining({ locale }),
        }),
      );
      expect(redis.set.mock.calls[0][0]).toContain(
        `customer:2026-10-16:${locale}`,
      );
      expect(redis.releaseLock).toHaveBeenCalledTimes(1);
      db.subscription.findFirst.mockResolvedValue(null);
      send.mockClear();
      await processor.processDailyHoroscopePushes();
      expect(send).not.toHaveBeenCalled();
    },
  );
});
