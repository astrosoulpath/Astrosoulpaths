import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { generateKundliHash } from '../../../../common/utlis/hash.util';
import { DailyInsightMapper } from '../provider/mapper/dailyinsight.mapper';
import { DailyHoroscopeAiService } from './daily-horoscope-ai.service';
import { VedicDailyContextMapper } from './vedic-daily-context.mapper';
import { TodayForYouMapper } from './today-for-you.mapper';
import { LocalVedicKundliProvider } from '../../../kundli/providers/local-vedic-kundli.provider';
import { birthParamsToUtc } from '../../../kundli/engine/vedic-time.util';
import { calculateVedicTransit } from '../../../kundli/engine/vedic-transit.util';
import { calculatePanchang } from '../../../kundli/engine/panchang.util';

export type DailyInsightDay = 'yesterday' | 'today' | 'tomorrow';

type DailyHoroscopeEntitlement = {
  planName: string;
  displayName: string;
  status: SubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  nextBillingAt: string | null;
};

type DailyHoroscopeResponse = {
  success: true;
  message: string;
  data: unknown;
  entitlement: DailyHoroscopeEntitlement;
};

const DAILY_HOROSCOPE_PLAN_NAME = 'DAILY_HOROSCOPE_MONTHLY';

@Injectable()
export class NakshatraDailyInsightService {
  private readonly logger = new Logger(NakshatraDailyInsightService.name);

  constructor(
    private readonly localVedicKundliProvider: LocalVedicKundliProvider,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dailyHoroscopeAiService: DailyHoroscopeAiService,
  ) {}

  async getNakshatraDailyInsight(
    supabaseUserId: string,
    day: DailyInsightDay = 'today',
  ) {
    const normalizedSupabaseId = supabaseUserId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    /*
     * Canonical authentication identity resolution.
     *
     * A customer may authenticate using more than one Supabase identity
     * (for example phone OTP and Google).
     *
     * UserAuthIdentity is authoritative.
     * User.supabaseId remains the legacy fallback.
     * Internal User.id is also supported for local/dev authentication.
     */
    const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedSupabaseId,
        },
      },
      select: {
        userId: true,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(mappedIdentity?.userId ? [{ id: mappedIdentity.userId }] : []),
          { supabaseId: normalizedSupabaseId },
          { id: normalizedSupabaseId },
        ],
      },
      select: {
        id: true,
        phone: true,
        isActive: true,
        isBlocked: true,
        userProfile: {
          select: {
            fullName: true,
            dateOfBirth: true,
            timeOfBirth: true,
            city: true,
            countryCode: true,
            latitude: true,
            longitude: true,
            timezone: true,
            timezoneName: true,
            lang: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Authenticated customer account was not found',
      );
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException('Customer account is inactive or blocked');
    }

    const now = new Date();

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        },
        startDate: {
          lte: now,
        },
        endDate: {
          gt: now,
        },
        subscriptionPlan: {
          name: DAILY_HOROSCOPE_PLAN_NAME,
          isActive: true,
        },
      },
      select: {
        id: true,
        subscriptionStatus: true,
        startDate: true,
        endDate: true,
        nextBillingAt: true,
        subscriptionPlan: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    const hasDailyHoroscopeOverride =
      user.phone?.trim() === '+918651540070';

    if (
      !hasDailyHoroscopeOverride &&
      (!subscription || !subscription.subscriptionPlan)
    ) {
      throw new ForbiddenException({
        code: 'DAILY_HOROSCOPE_SUBSCRIPTION_REQUIRED',
        message:
          'An active Personalized Daily Horoscope subscription is required',
        planName: DAILY_HOROSCOPE_PLAN_NAME,
      });
    }

    const profile = user.userProfile;

    if (!profile) {
      throw new BadRequestException({
        code: 'BIRTH_PROFILE_REQUIRED',
        message:
          'Complete your birth profile to receive a personalized daily horoscope',
      });
    }

    const fullName = profile.fullName?.trim();
    const birthDate = profile.dateOfBirth;
    const timeOfBirth = profile.timeOfBirth?.trim();
    const city = profile.city?.trim();
    const countryCode = profile.countryCode?.trim().toUpperCase();
    if (
      !fullName ||
      !birthDate ||
      !timeOfBirth ||
      !city ||
      !countryCode ||
      profile.latitude == null ||
      profile.longitude == null ||
      profile.timezone == null
    ) {
      throw new BadRequestException({
        code: 'BIRTH_PROFILE_INCOMPLETE',
        message:
          'Name, birth date, birth time and complete birth location are required',
      });
    }

    const requestedLanguageCode = profile.lang?.trim().toLowerCase();

    const language = requestedLanguageCode
      ? await this.prisma.appLanguage.findFirst({
          where: {
            code: requestedLanguageCode,
            isActive: true,
          },
          select: {
            code: true,
            englishName: true,
            nativeName: true,
          },
        })
      : await this.prisma.appLanguage.findFirst({
          where: {
            isActive: true,
          },
          orderBy: [
            {
              sortOrder: 'asc',
            },
            {
              englishName: 'asc',
            },
          ],
          select: {
            code: true,
            englishName: true,
            nativeName: true,
          },
        });

    if (!language) {
      throw new BadRequestException(
        'No active application language is configured',
      );
    }

    const localDateKey = this.resolveLocalDateKey(
      now,
      profile.timezoneName,
      profile.timezone,
    );

    const targetDate = new Date(`${localDateKey}T00:00:00.000Z`);

    if (day === 'yesterday') {
      targetDate.setUTCDate(targetDate.getUTCDate() - 1);
    }

    if (day === 'tomorrow') {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }

    const targetDateKey = targetDate.toISOString().slice(0, 10);

    const cacheKey = `daily-horoscope:v18:${user.id}:${targetDateKey}:${day}:${language.code}`;

    const parsedBirthTime = this.parseBirthTime(timeOfBirth);

    const cached = await this.redis.get<DailyHoroscopeResponse>(cacheKey);

    if (cached) {
      this.logger.log(
        `daily_insight.cache_hit userId=${user.id} targetDate=${targetDateKey}`,
      );

      return cached;
    }

    this.logger.log(
      `daily_insight.cache_miss userId=${user.id} targetDate=${targetDateKey}`,
    );

    const persisted = await this.prisma.dailyHoroscopeHistory.findUnique({
      where: {
        userId_targetDate: {
          userId: user.id,
          targetDate,
        },
      },
      select: {
        response: true,
        providerSource: true,
      },
    });

    if (
      persisted?.providerSource === 'local-vedic-plus-openai-v4' &&
      persisted?.response &&
      typeof persisted.response === 'object' &&
      !Array.isArray(persisted.response)
    ) {
      const persistedResponse =
        persisted.response as unknown as DailyHoroscopeResponse;

      if (
        persistedResponse.success === true &&
        persistedResponse.data &&
        typeof persistedResponse.data === 'object' &&
        !Array.isArray(persistedResponse.data) &&
        'todayForYou' in (persistedResponse.data as Record<string, unknown>) &&
        persistedResponse.entitlement &&
        (persistedResponse.data as any).generation?.language?.code ===
          language.code
      ) {
        this.logger.log(
          `daily_insight.db_history_hit userId=${user.id} targetDate=${targetDateKey}`,
        );

        await this.redis.set(cacheKey, persistedResponse, 60 * 60 * 6);

        return persistedResponse;
      }
    }

    this.logger.log(
      `daily_insight.db_history_miss userId=${user.id} targetDate=${targetDateKey}`,
    );

    // Production single-flight:
    // only one backend instance may perform paid Prokerala/OpenAI generation
    // for the same user/date/day/language at a time.
    const generationLockKey =
      `lock:daily-horoscope:v18:${user.id}:${targetDateKey}:${day}:${language.code}`;
    const generationLockOwner =
      `${Date.now()}:${Math.random().toString(36).slice(2)}`;

    let generationLockAcquired = await this.redis.setNX(
      generationLockKey,
      generationLockOwner,
      120,
    );

    if (!generationLockAcquired) {
      this.logger.log(
        `daily_insight.generation_wait userId=${user.id} targetDate=${targetDateKey}`,
      );

      // Another instance/request is generating this exact result.
      // Wait for its Redis result instead of making duplicate paid calls.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const generated =
          await this.redis.get<DailyHoroscopeResponse>(cacheKey);

        if (generated) {
          this.logger.log(
            `daily_insight.generation_wait_hit userId=${user.id} targetDate=${targetDateKey}`,
          );

          return generated;
        }
      }

      // The original worker may have crashed. Try to become the new owner.
      generationLockAcquired = await this.redis.setNX(
        generationLockKey,
        generationLockOwner,
        120,
      );

      if (!generationLockAcquired) {
        throw new ServiceUnavailableException({
          success: false,
          code: 'DAILY_HOROSCOPE_GENERATION_IN_PROGRESS',
          message:
            'Daily horoscope is currently being generated. Please try again shortly.',
        });
      }
    }

    try {
      // Double-check after acquiring the distributed lock.
      // A previous worker may have completed between our initial miss
      // and lock acquisition.
      const generatedAfterLock =
        await this.redis.get<DailyHoroscopeResponse>(cacheKey);

      if (generatedAfterLock) {
        this.logger.log(
          `daily_insight.lock_cache_hit userId=${user.id} targetDate=${targetDateKey}`,
        );

        return generatedAfterLock;
      }

      const persistedAfterLock =
        await this.prisma.dailyHoroscopeHistory.findUnique({
          where: {
            userId_targetDate: {
              userId: user.id,
              targetDate,
            },
          },
          select: {
            response: true,
            providerSource: true,
          },
        });

      if (
        persistedAfterLock?.providerSource === 'local-vedic-plus-openai-v4' &&
        persistedAfterLock.response &&
        typeof persistedAfterLock.response === 'object' &&
        !Array.isArray(persistedAfterLock.response)
      ) {
        const persistedResponse =
          persistedAfterLock.response as unknown as DailyHoroscopeResponse;

        if (
          persistedResponse.success === true &&
          persistedResponse.data &&
          typeof persistedResponse.data === 'object' &&
          !Array.isArray(persistedResponse.data) &&
          'todayForYou' in
            (persistedResponse.data as Record<string, unknown>) &&
          persistedResponse.entitlement &&
          (persistedResponse.data as any).generation?.language?.code ===
            language.code
        ) {
          await this.redis.set(cacheKey, persistedResponse, 60 * 60 * 6);

          this.logger.log(
            `daily_insight.lock_db_hit userId=${user.id} targetDate=${targetDateKey}`,
          );

          return persistedResponse;
        }
      }

    const providerUser = {
      name: fullName,
      birthYear: birthDate.getUTCFullYear(),
      birthMonth: birthDate.getUTCMonth() + 1,
      birthDay: birthDate.getUTCDate(),
      birthHour: parsedBirthTime.hour,
      birthMinute: parsedBirthTime.minute,
      birthSecond: parsedBirthTime.second,
      city,
      countryCode,
      targetYear: targetDate.getUTCFullYear(),
      targetMonth: targetDate.getUTCMonth() + 1,
      targetDay: targetDate.getUTCDate(),
      targetDate: targetDate.toISOString().slice(0, 10),
      requestedDay: day,
    };

    const astroParams: AstroParams = {
      dob: birthDate.toISOString().slice(0, 10),
      tob: [
        parsedBirthTime.hour,
        parsedBirthTime.minute,
        parsedBirthTime.second,
      ]
        .map((value) => value.toString().padStart(2, '0'))
        .join(':'),
      lat: Number(profile.latitude),
      lon: Number(profile.longitude),
      timezone: Number(profile.timezone),
      lang: 'en',
      name: fullName,
      place: city,
      userId: user.id,
    };

    const transitParams: AstroParams = {
      dob: targetDateKey,
      tob: '12:00:00',
      lat: Number(profile.latitude),
      lon: Number(profile.longitude),
      timezone: Number(profile.timezone),
      lang: 'en',
      name: fullName,
      place: city,
      userId: user.id,
    };

    this.logger.log(`daily_insight.request userId=${user.id}`);

    const optionalProviderCall = async <T>(
      label: string,
      request: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await request();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `daily_insight.optional_provider_unavailable provider=${label} userId=${user.id} targetDate=${targetDateKey} error=${message}`,
        );

        return null;
      }
    };

    /*
     * COST OPTIMIZATION:
     * Natal Vedic facts are deterministic for the same birth details.
     * Reuse the already persisted Prokerala Kundli instead of paying for
     * the same natal calculation on every daily-horoscope generation.
     *
     * Full stored Kundli remains untouched. Transit/Panchang stay live.
     */
    let cachedNatalReport: any = null;

    try {
      const kundliHash = generateKundliHash(astroParams);

      const cachedKundli = await this.prisma.kundli.findUnique({
        where: { hash: kundliHash },
        select: {
          data: {
            select: {
              vedic: true,
            },
          },
        },
      });

      const candidate = cachedKundli?.data?.vedic as any;

      if (
        candidate &&
        typeof candidate === 'object' &&
        candidate.provider === 'local-vedic'
      ) {
        cachedNatalReport = candidate;

        this.logger.log(
          `daily_insight.natal_cache.hit userId=${user.id} targetDate=${targetDateKey}`,
        );
      } else {
        this.logger.log(
          `daily_insight.natal_cache.miss userId=${user.id} targetDate=${targetDateKey}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `daily_insight.natal_cache.lookup_failed userId=${user.id} targetDate=${targetDateKey} error=${message}`,
      );
    }

    const cachedBirthChart =
      cachedNatalReport?.birthChart ??
      cachedNatalReport?.providerPayload?.kundli ??
      null;

    const cachedPlanetPositions =
      cachedNatalReport?.planetaryPositions ?? null;

    /*
     * The daily mapper understands the real Prokerala
     * dasha_periods -> antardasha hierarchy.
     * Prefer preserved raw provider Dasha when available.
     */
    const cachedMahaDasha =
      cachedNatalReport?.dasha?.mahaDasha ??
      cachedNatalReport?.dasha ??
      null;

    /*
     * COST OPTIMIZATION:
     * Transit planets and Panchang depend on target date/time + location.
     * Share them across matching requests without including user identity
     * or birth details in the shared Redis cache key.
     */
    const sharedDailyContextKey = [
      'daily-vedic-context:v2',
      targetDateKey,
      '12-00-00',
      Number(transitParams.lat).toFixed(4),
      Number(transitParams.lon).toFixed(4),
      Number(transitParams.timezone).toFixed(2),
      transitParams.lang ?? 'en',
    ].join(':');

    type SharedDailyVedicContext = {
      transitPlanetPositions: any;
      panchang: any;
    };

    let sharedDailyContext =
      await this.redis.get<SharedDailyVedicContext>(sharedDailyContextKey);

    if (sharedDailyContext) {
      this.logger.log('cost.cache feature=daily_vedic_context result=hit');
    } else {
      this.logger.log('cost.cache feature=daily_vedic_context result=miss');
    }

    /*
     * LOCAL VEDIC ENGINE
     * Natal data comes from our own Kundli engine.
     * Transit/Panchang use the requested date at local noon.
     */
    const localNatalReport =
      await this.localVedicKundliProvider.generate(astroParams, 'en');

    const birthChart =
      localNatalReport.birthChart ?? null;

    const planetPositions =
      localNatalReport.planetaryPositions ?? null;

    const mahaDasha =
      localNatalReport.dasha ?? null;

    const targetTransitUtc =
      birthParamsToUtc(transitParams);

    const localTransit =
      calculateVedicTransit(targetTransitUtc);

    const transitPlanetPositions =
      localTransit.planets;

    const transitSun =
      localTransit.planets.find(
        (planet) => planet.name === 'Sun',
      );

    const transitMoon =
      localTransit.planets.find(
        (planet) => planet.name === 'Moon',
      );

    if (!transitSun || !transitMoon) {
      throw new ServiceUnavailableException({
        success: false,
        code: 'LOCAL_VEDIC_TRANSIT_INCOMPLETE',
        message: 'Local Vedic transit calculation is incomplete.',
      });
    }

    const panchang =
      calculatePanchang(
        transitSun.longitude,
        transitMoon.longitude,
        targetTransitUtc,
      );

    this.logger.log(
      `daily_insight.local_vedic_calculation.ready userId=${user.id} targetDate=${targetDateKey}`,
    );

    const vedicEnrichmentAvailable =
      birthChart !== null ||
      planetPositions !== null ||
      transitPlanetPositions !== null ||
      mahaDasha !== null ||
      panchang !== null;

    if (vedicEnrichmentAvailable) {
      this.logger.log(
        `daily_insight.vedic_enrichment.available userId=${user.id} targetDate=${targetDateKey}`,
      );
    } else {
      this.logger.warn(
        `daily_insight.vedic_enrichment.unavailable userId=${user.id} targetDate=${targetDateKey}`,
      );
    }

    if (!vedicEnrichmentAvailable) {
      this.logger.error(
        `daily_insight.all_calculation_providers_unavailable userId=${user.id} targetDate=${targetDateKey}`,
      );

      throw new ServiceUnavailableException({
        success: false,
        code: 'DAILY_HOROSCOPE_PROVIDERS_UNAVAILABLE',
        message:
          'Daily horoscope calculation is temporarily unavailable. Please try again shortly.',
      });
    }

    const normalizedDailyResponse = {
      data: {},
    };
    const data = DailyInsightMapper.toUI(normalizedDailyResponse, providerUser);

    const vedicContext = VedicDailyContextMapper.build({
      requestedDate: targetDateKey,
      requestedDay: day,
      nakshatraDaily: normalizedDailyResponse.data,
      birthChart,
      natalPlanetPositions: planetPositions,
      transitPlanetPositions,
      transitSnapshot: {
        date: targetDateKey,
        localTime: '12:00:00',
        timezone: Number(profile.timezone),
        timezoneName: profile.timezoneName ?? null,
      },
      mahaDasha,
      panchang,
    });

    const ai = await this.dailyHoroscopeAiService.generate({
      name: fullName,
      targetDate: providerUser.targetDate,
      requestedDay: day,
      languageCode: language.code,
      languageName: language.englishName,
      languageNativeName: language.nativeName,
      vedicData: vedicContext,
    });

    const todayForYou = TodayForYouMapper.build({
      mappedDailyInsight: data,

      vedicContext,

      panchang,

      ai,
    });

    const personalizedData = {
      ...data,

      moon: {
        ...data.moon,
        current: {
          ...data.moon.current,
          nakshatra: vedicContext.currentMoon.nakshatra,
          number: vedicContext.currentMoon.nakshatraNumber,
          lord: vedicContext.currentMoon.nakshatraLord,
        },
      },

      lifeAreas: [
        {
          title: 'General',
          description: ai.lifeAreas.general,
          emoji: data.lifeAreas?.[0]?.emoji ?? '',
        },
        {
          title: 'Career',
          description: ai.lifeAreas.career,
          emoji: data.lifeAreas?.[1]?.emoji ?? '',
        },
        {
          title: 'Relationships',
          description: ai.lifeAreas.relationships,
          emoji: data.lifeAreas?.[2]?.emoji ?? '',
        },
        {
          title: 'Health',
          description: ai.lifeAreas.health,
          emoji: data.lifeAreas?.[3]?.emoji ?? '',
        },
        {
          title: 'Finance',
          description: ai.lifeAreas.finance,
          emoji: data.lifeAreas?.[4]?.emoji ?? '',
        },
      ],

      dailyHighlights: {
        ...(data.dailyHighlights ?? {}),
        mood: ai.mood,
        focus: ai.focusArea,
        dailyAdvice: ai.dailyAdvice,
      },

      guidance: {
        ...(data.guidance ?? {}),
        favorableActivities: ai.favorableActivities,
        avoidActivities: ai.cautionActivities,
      },

      summary: {
        ...(data.summary ?? {}),
        bestFor:
          ai.favorableActivities.length > 0
            ? ai.favorableActivities.join(', ')
            : null,
        cautionFor:
          ai.cautionActivities.length > 0
            ? ai.cautionActivities.join(', ')
            : null,
      },

      lucky: {
        ...(data.lucky ?? {}),

        // Lucky values are provider-backed only.
        // OpenAI is interpretation-only and must never author these.
        colors: vedicContext.providerGuidance.luckyColors,
        numbers: vedicContext.providerGuidance.luckyNumbers,
      },

      todayForYou,
      vedic: vedicContext,
      ai: {
        notificationTitle: ai.notificationTitle,
        shortReading: ai.shortReading,
        dailyAdvice: ai.dailyAdvice,
        mood: ai.mood,
        focusArea: ai.focusArea,
        luckyColor: ai.luckyColor,
        luckyNumber: ai.luckyNumber,
        favorableActivities: ai.favorableActivities,
        cautionActivities: ai.cautionActivities,
        generalGuidance: ai.generalGuidance,
      },
      generation: {
        source: 'local-vedic-plus-openai-v4',
        model: ai.model,
        targetDate: providerUser.targetDate,
        language: {
          code: language.code,
          englishName: language.englishName,
          nativeName: language.nativeName,
        },
        locale: {
          countryCode,
          timezone: Number(profile.timezone),
          timezoneName: profile.timezoneName ?? null,
          localDate: targetDateKey,
        },
      },
    };

    const result: DailyHoroscopeResponse = {
      success: true,
      message: 'Personalized daily horoscope fetched successfully',
      data: personalizedData,
      entitlement: {
        planName:
          subscription?.subscriptionPlan?.name ?? DAILY_HOROSCOPE_PLAN_NAME,
        displayName:
          subscription?.subscriptionPlan?.displayName ??
          'Personalized Daily Horoscope',
        status: subscription?.subscriptionStatus ?? SubscriptionStatus.FREE,
        startDate: subscription?.startDate?.toISOString() ?? null,
        endDate: subscription?.endDate?.toISOString() ?? null,
        nextBillingAt: subscription?.nextBillingAt?.toISOString() ?? null,
      },
    };

    await this.prisma.dailyHoroscopeHistory.upsert({
      where: {
        userId_targetDate: {
          userId: user.id,
          targetDate,
        },
      },
      create: {
        userId: user.id,
        targetDate,
        requestedDay: day,
        vedic: JSON.parse(JSON.stringify(vedicContext)),
        ai: JSON.parse(JSON.stringify(personalizedData.ai)),
        response: JSON.parse(JSON.stringify(result)),
        providerSource: personalizedData.generation.source,
        aiModel: personalizedData.generation.model ?? null,
      },
      update: {
        requestedDay: day,
        vedic: JSON.parse(JSON.stringify(vedicContext)),
        ai: JSON.parse(JSON.stringify(personalizedData.ai)),
        response: JSON.parse(JSON.stringify(result)),
        providerSource: personalizedData.generation.source,
        aiModel: personalizedData.generation.model ?? null,
      },
    });

    this.logger.log(
      `daily_insight.history_upsert userId=${user.id} targetDate=${targetDateKey}`,
    );

    await this.redis.set(cacheKey, result, 60 * 60 * 6);

    this.logger.log(
      `daily_insight.cache_store userId=${user.id} targetDate=${targetDateKey}`,
    );

    return result;
    } finally {
      const released = await this.redis.releaseLock(
        generationLockKey,
        generationLockOwner,
      );

      this.logger.log(
        `daily_insight.generation_lock_release userId=${user.id} targetDate=${targetDateKey} released=${released}`,
      );
    }
  }

  async getDailyHoroscopeHistory(supabaseUserId: string, limit = 30) {
    const normalizedSupabaseId = supabaseUserId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 90) {
      throw new BadRequestException('limit must be between 1 and 90');
    }

    /*
     * Canonical authentication identity resolution.
     *
     * A customer may authenticate using more than one Supabase identity
     * (for example phone OTP and Google).
     *
     * UserAuthIdentity is authoritative.
     * User.supabaseId remains the legacy fallback.
     * Internal User.id is also supported for local/dev authentication.
     */
    const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedSupabaseId,
        },
      },
      select: {
        userId: true,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(mappedIdentity?.userId ? [{ id: mappedIdentity.userId }] : []),
          { supabaseId: normalizedSupabaseId },
          { id: normalizedSupabaseId },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    const now = new Date();

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        },
        startDate: {
          lte: now,
        },
        endDate: {
          gt: now,
        },
        subscriptionPlan: {
          name: DAILY_HOROSCOPE_PLAN_NAME,
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });

    if (!subscription) {
      throw new ForbiddenException(
        'An active Daily Horoscope subscription is required',
      );
    }

    const rows = await this.prisma.dailyHoroscopeHistory.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        targetDate: 'desc',
      },
      take: limit,
    });

    return {
      success: true,
      message: 'Daily horoscope history fetched successfully',
      data: rows.map((row) => {
        const storedResponse =
          row.response &&
          typeof row.response === 'object' &&
          !Array.isArray(row.response)
            ? (row.response as Record<string, unknown>)
            : null;

        return {
          id: row.id,
          targetDate: row.targetDate.toISOString().slice(0, 10),
          requestedDay: row.requestedDay,
          horoscope: storedResponse?.data ?? null,
          providerSource: row.providerSource,
          aiModel: row.aiModel,
          generatedAt: row.generatedAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    };
  }
  private resolveLocalDateKey(
    now: Date,
    timezoneName?: string | null,
    timezone?: number | null,
  ): string {
    const zone = timezoneName?.trim();

    if (zone) {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(now);

        const read = (type: string) =>
          parts.find((part) => part.type === type)?.value ?? '';

        const year = read('year');
        const month = read('month');
        const day = read('day');

        if (year && month && day) {
          return `${year}-${month}-${day}`;
        }
      } catch {
        // Fall through to numeric timezone offset.
      }
    }

    const offsetHours =
      typeof timezone === 'number' && Number.isFinite(timezone) ? timezone : 0;

    const local = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);

    return [
      local.getUTCFullYear(),
      String(local.getUTCMonth() + 1).padStart(2, '0'),
      String(local.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  private parseBirthTime(source: string) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(source);

    if (!match) {
      throw new BadRequestException({
        code: 'INVALID_BIRTH_TIME',
        message: 'Birth time must be in HH:mm or HH:mm:ss format',
      });
    }

    return {
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: Number(match[3] ?? 0),
    };
  }
}














