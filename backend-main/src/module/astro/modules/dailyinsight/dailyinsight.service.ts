import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { AstrologyProvider } from '../provider/astrologyapi.provider';
import { DailyInsightMapper } from '../provider/mapper/dailyinsight.mapper';

@Injectable()
export class NakshatraDailyInsightService {
  private readonly logger = new Logger(NakshatraDailyInsightService.name);

  constructor(private readonly astrologyProvider: AstrologyProvider) {}

  /**
   * 🌙 Fetch Vedic Nakshatra-Based Daily Insight
   * Production-ready:
   * - Logging
   * - Validation
   * - Safe fallback
   * - API resilience
   * - Investor/demo safe
   */
  async getNakshatraDailyInsight() {
    try {
      this.logger.log('📡 Fetching Vedic Nakshatra Daily Insight');

      // ========================================
      // 🔥 HARDCODED USER (Replace with DB later)
      // ========================================
      const user = {
        name: 'Abhishek Somani',
        birthYear: 1983,
        birthMonth: 1,
        birthDay: 15,
        birthHour: 16,
        birthMinute: 56,
        birthSecond: 0, // Recommended
        city: 'Delhi',
        countryCode: 'IN',
      };

      // ========================================
      // 🔌 API CALL
      // ========================================
      const apiResponse =
        await this.astrologyProvider.getPersonalDailyHoroscope(user);

      if (!apiResponse || !apiResponse.data) {
        this.logger.error('❌ Invalid Nakshatra API response structure');
        throw new InternalServerErrorException(
          'Invalid Nakshatra prediction response',
        );
      }

      // ========================================
      // 🔄 MAP TO UI STRUCTURE
      // ========================================
      const uiData = DailyInsightMapper.toUI(apiResponse, user);

      // ========================================
      // ✅ SUCCESS RESPONSE
      // ========================================
      return {
        success: true,
        message: 'Nakshatra daily insight fetched successfully',
        data: uiData,
      };
    } catch (error: any) {
      this.logger.error(
        '❌ Nakshatra Daily Insight Error',
        error?.response?.data || error?.message || error,
      );

      // ========================================
      // 🔥 SAFE FALLBACK
      // ========================================
      return {
        success: false,
        message: 'Showing fallback Vedic insight data',
        data: this.getFallbackData(),
      };
    }
  }

  // ========================================
  // 🔥 FALLBACK DATA
  // ========================================
  private getFallbackData() {
    return {
      user: {
        name: 'User',
        greeting: 'Good Evening',
        date: new Date().toISOString(),

        natalNakshatra: 'Unknown',
        natalNakshatraNumber: 0,
        natalNakshatraLord: 'Unknown',

        currentNakshatra: 'Unknown',
        currentNakshatraNumber: 0,
      },

      cosmic: {
        overallScore: 0,
        tarabala: {
          name: 'Unknown',
          count: 0,
          effect: 'Unavailable',
        },
      },

      moon: {
        current: {
          nakshatra: 'Unavailable',
          number: 0,
          lord: 'Unavailable',
          deity: 'Unavailable',
          pada: 0,
        },
        natal: {
          nakshatra: 'Unavailable',
          number: 0,
          lord: 'Unavailable',
        },
      },

      lifeAreas: [
        {
          title: 'General',
          description: 'Daily cosmic guidance temporarily unavailable.',
          emoji: '✨',
        },
        {
          title: 'Career',
          description: 'Professional energy data unavailable.',
          emoji: '💼',
        },
        {
          title: 'Relationships',
          description: 'Relationship energy data unavailable.',
          emoji: '❤️',
        },
        {
          title: 'Health',
          description: 'Health energy data unavailable.',
          emoji: '🧘',
        },
        {
          title: 'Finance',
          description: 'Financial energy data unavailable.',
          emoji: '💰',
        },
      ],

      lucky: {
        colors: [],
        numbers: [],
      },

      guidance: {
        favorableActivities: [],
        avoidActivities: [],
      },

      summary: {
        bestFor: 'Stay mindful and reflective.',
        cautionFor: 'Avoid impulsive decisions.',
      },

      metadata: {
        requestId: null,
        apiVersion: null,
        calculationTimeMs: null,
      },
    };
  }
}
