import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  requireHoroscopeLocale,
  validateHoroscopeText,
} from './horoscope-localization';
import { horoscopeDailyDeliveryKey, horoscopeDeliveryPolicyEnabled } from './horoscope-delivery-policy';

export const HOROSCOPE_CONTENT_VERSION = 'daily-v22';
export function durableHoroscopeEnabled() {
  return (
    process.env.HOROSCOPE_DURABLE_ENABLED === 'true' &&
    process.env.HOROSCOPE_SCHEMA_READY === 'true'
  );
}
export function horoscopeOutboxEnabled() {
  return (
    durableHoroscopeEnabled() && process.env.HOROSCOPE_OUTBOX_ENABLED === 'true' && horoscopeDeliveryPolicyEnabled()
  );
}
export type ReadingContext = {
  userId: string;
  subscriptionId: string;
  localDate: string;
  locale: string;
  timezone: string;
  profileFingerprint: string;
};
export type DurableReading = ReadingContext & {
  id: string;
  contentVersion: string;
  response: any;
  state: string;
};
type Database = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export function readingIdentity(context: ReadingContext) {
  requireHoroscopeLocale(context.locale);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.localDate))
    throw new ServiceUnavailableException('Invalid horoscope date');
  return createHash('sha256')
    .update(
      JSON.stringify([
        context.userId,
        context.localDate,
        context.locale,
        HOROSCOPE_CONTENT_VERSION,
      ]),
    )
    .digest('hex');
}

export class HoroscopeDurableStore {
  constructor(private readonly db: Database) {}
  async generate(
    context: ReadingContext,
    produce: () => Promise<any>,
  ): Promise<DurableReading> {
    if (!durableHoroscopeEnabled())
      throw new ServiceUnavailableException(
        'Durable horoscope is not activated',
      );
    const id = readingIdentity(context),
      token = randomUUID(),
      version = HOROSCOPE_CONTENT_VERSION;
    const claimed = await this.db.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public."PersonalizedHoroscopeReading"
      ("id","userId","subscriptionId","localDate","locale","contentVersion","timezone","profileFingerprint","state","attempts","leaseToken","leaseUntil")
      VALUES (${id},${context.userId},${context.subscriptionId},${context.localDate}::date,${context.locale},${version},${context.timezone},${context.profileFingerprint},'GENERATING',1,${token},CURRENT_TIMESTAMP + interval '10 minutes')
      ON CONFLICT ("userId","localDate","locale","contentVersion") DO UPDATE SET
        "state"='GENERATING',"attempts"="PersonalizedHoroscopeReading"."attempts"+1,"leaseToken"=${token},
        "leaseUntil"=CURRENT_TIMESTAMP + interval '10 minutes',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "PersonalizedHoroscopeReading"."profileFingerprint"=${context.profileFingerprint} AND "PersonalizedHoroscopeReading"."attempts" < 3 AND
        (("PersonalizedHoroscopeReading"."state"='FAILED' AND "PersonalizedHoroscopeReading"."nextAttemptAt" <= CURRENT_TIMESTAMP)
        OR ("PersonalizedHoroscopeReading"."state"='GENERATING' AND "PersonalizedHoroscopeReading"."leaseUntil" < CURRENT_TIMESTAMP))
      RETURNING "id"`;
    if (!claimed.length) {
      const rows = await this.db.$queryRaw<
        Array<DurableReading & { attempts: number }>
      >`SELECT * FROM public."PersonalizedHoroscopeReading" WHERE "id"=${id}`;
      if (rows[0]?.state === 'GENERATING' && rows[0].attempts >= 3) {
        await this.db
          .$executeRaw`UPDATE public."PersonalizedHoroscopeReading" SET "state"='FAILED',"failureCode"='GENERATION_RETRY_EXHAUSTED',
          "leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=CURRENT_TIMESTAMP
          WHERE "id"=${id} AND "state"='GENERATING' AND "attempts">=3 AND "leaseUntil"<CURRENT_TIMESTAMP`;
      }
      if (
        rows[0]?.state === 'READY' &&
        rows[0].profileFingerprint === context.profileFingerprint
      ) {
        if (
          rows[0].response?.data?.generation?.language?.code !== context.locale
        )
          throw new ServiceUnavailableException(
            'Persisted horoscope locale mismatch',
          );
        validateHoroscopeText(context.locale, [
          rows[0].response?.data?.ai?.notificationTitle,
          rows[0].response?.data?.ai?.shortReading,
          rows[0].response?.data?.ai?.dailyAdvice,
        ]);
        return rows[0];
      }
      throw new ServiceUnavailableException(
        'Horoscope is generating, requires profile-version review, or retry limit reached',
      );
    }
    try {
      const response = await produce();
      if (response?.data?.generation?.language?.code !== context.locale)
        throw new ServiceUnavailableException('Generated locale mismatch');
      validateHoroscopeText(context.locale, [
        response?.data?.ai?.notificationTitle,
        response?.data?.ai?.shortReading,
        response?.data?.ai?.dailyAdvice,
      ]);
      const count = await this.db
        .$executeRaw`UPDATE public."PersonalizedHoroscopeReading" SET "state"='READY',"response"=${JSON.stringify(response)}::jsonb,
        "leaseToken"=NULL,"leaseUntil"=NULL,"failureCode"=NULL,"updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${id} AND "leaseToken"=${token} AND "state"='GENERATING' AND "leaseUntil">CURRENT_TIMESTAMP`;
      if (count !== 1)
        throw new ServiceUnavailableException(
          'Horoscope generation ownership expired',
        );
      return {
        ...context,
        id,
        contentVersion: version,
        response,
        state: 'READY',
      };
    } catch {
      await this.db
        .$executeRaw`UPDATE public."PersonalizedHoroscopeReading" SET "state"='FAILED',"failureCode"='GENERATION_OR_LOCALIZATION_FAILED',
        "nextAttemptAt"=CURRENT_TIMESTAMP + interval '5 minutes',"leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${id} AND "leaseToken"=${token} AND "state"='GENERATING'`;
      throw new ServiceUnavailableException(
        'Personalized horoscope generation unavailable',
      );
    }
  }

  async enqueue(
    reading: DurableReading,
    deviceIds: string[],
    scheduledAt: Date,
  ) {
    if (!horoscopeOutboxEnabled())
      throw new ServiceUnavailableException(
        'Horoscope outbox is not activated',
      );
    // A single deterministic active device; the UNIQUE key is customer/day,
    // independent of device, language or content version. No old row is rewritten.
    const deviceId = [...new Set(deviceIds)].filter(id => id.trim()).sort()[0];
    if (deviceId) {
      const key = horoscopeDailyDeliveryKey(reading.userId, reading.localDate);
      await this.db.$executeRaw`INSERT INTO public."HoroscopeNotificationOutbox"
        ("id","idempotencyKey","userId","subscriptionId","readingId","deviceId","localDate","locale","scheduledAt","nextAttemptAt")
        SELECT ${key},${key},${reading.userId},${reading.subscriptionId},${reading.id},${deviceId},${reading.localDate}::date,${reading.locale},${scheduledAt},${scheduledAt}
        WHERE NOT EXISTS (SELECT 1 FROM public."HoroscopeNotificationOutbox" WHERE "userId"=${reading.userId} AND "localDate"=${reading.localDate}::date AND "notificationType"='horoscope')
        ON CONFLICT ("idempotencyKey") DO NOTHING`;
    }
  }
}
