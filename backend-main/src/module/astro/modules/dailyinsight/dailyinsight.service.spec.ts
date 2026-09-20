import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { LocalVedicKundliProvider } from '../../../kundli/providers/local-vedic-kundli.provider';
import { DailyHoroscopeAiService } from './daily-horoscope-ai.service';
import { NakshatraDailyInsightService } from './dailyinsight.service';

describe('NakshatraDailyInsightService', () => {
  let service: NakshatraDailyInsightService;

  const localVedicKundliProviderMock = {
    generate: jest.fn(),
  };

  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const dailyHoroscopeAiServiceMock = {
    generate: jest.fn(),
  };

  const prismaMock = {
    dailyHoroscopeHistory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    userAuthIdentity: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    appLanguage: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue(undefined);
    redisMock.del.mockResolvedValue(undefined);

    prismaMock.appLanguage.findFirst.mockResolvedValue({
      code: 'en',
      englishName: 'English',
      nativeName: 'English',
    });
dailyHoroscopeAiServiceMock.generate.mockResolvedValue({
      shortReading: 'Test personalized reading',
      dailyAdvice: 'Test daily advice',
      mood: 'Balanced',
      focusArea: 'Focus',
      luckyColor: 'Not specified',
      luckyNumber: null,
      favorableActivities: [],
      cautionActivities: [],
      generalGuidance: 'Test general guidance',
      lifeAreas: {
        general: 'Test general life-area guidance',
        career: 'Test career life-area guidance',
        relationships: 'Test relationships life-area guidance',
        health: 'Test health life-area guidance',
        finance: 'Test finance life-area guidance',
      },
      model: 'test-model',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NakshatraDailyInsightService,
        {
          provide: LocalVedicKundliProvider,
          useValue: localVedicKundliProviderMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: DailyHoroscopeAiService,
          useValue: dailyHoroscopeAiServiceMock,
        },
      ],
    }).compile();

    service = module.get<NakshatraDailyInsightService>(
      NakshatraDailyInsightService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a missing authenticated user ID', async () => {
    await expect(service.getNakshatraDailyInsight('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires an active daily horoscope subscription', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'customer-1',
      isActive: true,
      isBlocked: false,
      userProfile: {
        fullName: 'Test Customer',
        dateOfBirth: new Date('1995-01-10T00:00:00.000Z'),
        timeOfBirth: '10:30',
        city: 'Patna',
        countryCode: 'IN',
        latitude: 25.5941,
        longitude: 85.1376,
        timezone: 5.5,
        timezoneName: 'Asia/Kolkata',
      },
    });

    prismaMock.subscription.findFirst.mockResolvedValue(null);

    await expect(
      service.getNakshatraDailyInsight('supabase-customer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['yesterday', -1],
    ['today', 0],
    ['tomorrow', 1],
  ] as const)(
    'maps %s to the correct target date',
    async (requestedDay, offsetDays) => {
      const now = new Date();

      prismaMock.user.findFirst.mockResolvedValue({
        id: 'customer-1',
        isActive: true,
        isBlocked: false,
        userProfile: {
          fullName: 'Test Customer',
          dateOfBirth: new Date('1995-01-10T00:00:00.000Z'),
          timeOfBirth: '10:30:15',
          city: 'Patna',
          countryCode: 'IN',
          latitude: 25.5941,
          longitude: 85.1376,
          timezone: 5.5,
          timezoneName: 'Asia/Kolkata',
        },
      });

      prismaMock.subscription.findFirst.mockResolvedValue({
        id: 'subscription-1',
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        startDate: new Date(now.getTime() - 60_000),
        endDate: new Date(now.getTime() + 86_400_000),
        nextBillingAt: new Date(now.getTime() + 86_400_000),
        subscriptionPlan: {
          name: 'DAILY_HOROSCOPE_MONTHLY',
          displayName: 'Personalized Daily Horoscope - Monthly',
        },
      });

      const localParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);

      const readLocalPart = (type: string) =>
        localParts.find((part) => part.type === type)?.value ?? '';

      const localDateKey = [
        readLocalPart('year'),
        readLocalPart('month'),
        readLocalPart('day'),
      ].join('-');

      const expectedDate = new Date(`${localDateKey}T00:00:00.000Z`);
      expectedDate.setUTCDate(expectedDate.getUTCDate() + offsetDays);

      await service.getNakshatraDailyInsight(
        'supabase-customer-1',
        requestedDay,
      );
    },
  );
  it('uses the authenticated customer birth profile', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'customer-1',
      isActive: true,
      isBlocked: false,
      userProfile: {
        fullName: 'Test Customer',
        dateOfBirth: new Date('1995-01-10T00:00:00.000Z'),
        timeOfBirth: '10:30:15',
        city: 'Patna',
        countryCode: 'IN',
        latitude: 25.5941,
        longitude: 85.1376,
        timezone: 5.5,
        timezoneName: 'Asia/Kolkata',
      },
    });

    prismaMock.subscription.findFirst.mockResolvedValue({
      id: 'subscription-1',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-01T00:00:00.000Z'),
      nextBillingAt: new Date('2026-09-01T00:00:00.000Z'),
      subscriptionPlan: {
        name: 'DAILY_HOROSCOPE_MONTHLY',
        displayName: 'Personalized Daily Horoscope - Monthly',
      },
    });

    const result = await service.getNakshatraDailyInsight(
      'supabase-customer-1',
    );

    expect(result.success).toBe(true);

    expect(result.entitlement.planName).toBe('DAILY_HOROSCOPE_MONTHLY');
  });
});








