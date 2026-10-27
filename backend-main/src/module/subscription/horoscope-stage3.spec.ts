jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));
import OpenAI from 'openai';
import { DailyHoroscopeAiService } from '../astro/modules/dailyinsight/daily-horoscope-ai.service';
import { createHmac } from 'node:crypto';
import { HoroscopeDurableStore } from './horoscope-durable.store';
import { NotificationsService } from '../notifications/notifications.service';
import { RazorpayVerificationService } from '../payments/razorpay-verification.service';

describe('horoscope Stage 3 safety (mocks only)', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.HOROSCOPE_DURABLE_ENABLED = 'true';
    process.env.HOROSCOPE_SCHEMA_READY = 'true';
  });
  afterEach(() => {
    process.env = { ...original };
  });
  it('terminal generation crash is classified only after lease expiry, never retried', async () => {
    const db: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ state: 'GENERATING', attempts: 3 }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const produce = jest.fn();
    await expect(
      new HoroscopeDurableStore(db).generate(
        {
          userId: 'synthetic',
          subscriptionId: 'subscription',
          localDate: '2026-10-16',
          locale: 'en',
          timezone: 'UTC',
          profileFingerprint: 'synthetic',
        },
        produce,
      ),
    ).rejects.toThrow('retry limit');
    expect(produce).not.toHaveBeenCalled();
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain(
      '"leaseUntil"<CURRENT_TIMESTAMP',
    );
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain(
      'GENERATION_RETRY_EXHAUSTED',
    );
  });
  it.each([true, false])(
    'notification consent %s writes only the authenticated canonical owner',
    async (enabled) => {
      const db: any = {
        userAuthIdentity: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ userId: 'canonical-owner' }),
        },
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      db.subscription={findFirst:jest.fn().mockResolvedValue({subscriptionStatus:'ACTIVE',subscriptionPlan:{name:'DAILY_HOROSCOPE_MONTHLY',price:1,currency:'USD',durationDays:30}})};
      const result = await new NotificationsService(db).setHoroscopePreference(
        'authenticated-subject',
        enabled,
      );
      expect(result.data.enabled).toBe(enabled);
      expect(db.$executeRaw.mock.calls[0][1]).toBe('canonical-owner');
      expect(db.$executeRaw.mock.calls[0]).not.toContain(
        'authenticated-subject',
      );
    },
  );
  it.each([undefined, 'true', 1, null])(
    'nonboolean consent is rejected without writes: %s',
    async (enabled) => {
      const db: any = { $executeRaw: jest.fn() };
      await expect(
        new NotificationsService(db).setHoroscopePreference('subject', enabled),
      ).rejects.toThrow('Explicit');
      expect(db.$executeRaw).not.toHaveBeenCalled();
    },
  );
  it('pre-migration preference mutation is unavailable without querying missing tables', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    const db: any = { $executeRaw: jest.fn() };
    await expect(
      new NotificationsService(db).setHoroscopePreference('subject', true),
    ).rejects.toThrow('not activated');
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it('synthetic webhook signature accepts exact bytes and rejects tampering or wrong signature', () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'synthetic-test-only';
    const body = Buffer.from('{"event":"payment.captured","synthetic":true}');
    const signature = createHmac('sha256', 'synthetic-test-only')
      .update(body)
      .digest('hex');
    const service = new RazorpayVerificationService();
    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
    expect(
      service.verifyWebhookSignature(
        Buffer.from(body.toString() + ' '),
        signature,
      ),
    ).toBe(false);
    expect(service.verifyWebhookSignature(body, 'bad')).toBe(false);
  });
  it('AI provider failures never log raw exceptions, credentials or customer context', async () => {
    process.env.OPENAI_API_KEY = 'synthetic-only';
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest
          .fn()
          .mockRejectedValue(new Error('SENSITIVE_SYNTHETIC_MARKER')),
      },
    }));
    const service = new DailyHoroscopeAiService();
    const logger = { log: jest.fn(), error: jest.fn() };
    (service as any).logger = logger;
    await expect(
      service.generate({
        name: 'Synthetic',
        targetDate: '2026-10-16',
        requestedDay: 'today',
        languageCode: 'en',
        languageName: 'English',
        languageNativeName: 'English',
        vedicData: { synthetic: true },
      }),
    ).rejects.toThrow('temporarily unavailable');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'SENSITIVE_SYNTHETIC_MARKER',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('category=PROVIDER_REQUEST_FAILED'),
    );
  });
});
