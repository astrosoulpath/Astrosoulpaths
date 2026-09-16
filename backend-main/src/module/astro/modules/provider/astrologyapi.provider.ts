import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AstrologyProvider {
  private client: AxiosInstance;
  private readonly baseUrl = 'https://api.astrology-api.io/api/v3';
  private readonly apiKey = process.env.ASTROLOGY_API_KEY;
  private readonly logger = new Logger(AstrologyProvider.name);

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  // COMMON POST HANDLER (same pattern as your VedicProvider)
  private async post(endpoint: string, payload: any) {
    try {
      const response = await this.client.post(endpoint, payload);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Astrology API Error [${endpoint}]`,
        error?.response?.data || error.message,
      );

      throw new HttpException(
        error?.response?.data || 'Astrology API failed',
        error?.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // PAYLOAD BUILDER (like formatParams)
  private validateDailyHoroscopeUser(user: any) {
    if (!user) {
      throw new BadRequestException('Horoscope profile is required');
    }

    finalName: if (!user.name?.toString().trim()) {
      throw new BadRequestException('Full name is required for horoscope');
    }

    const birthYear = Number(user.birthYear);
    const birthMonth = Number(user.birthMonth);
    const birthDay = Number(user.birthDay);
    const birthHour = Number(user.birthHour);
    const birthMinute = Number(user.birthMinute);
    const birthSecond = Number(user.birthSecond ?? 0);

    if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > 2100) {
      throw new BadRequestException('Valid birth year is required');
    }

    if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
      throw new BadRequestException('Valid birth month is required');
    }

    if (!Number.isInteger(birthDay) || birthDay < 1 || birthDay > 31) {
      throw new BadRequestException('Valid birth day is required');
    }

    if (!Number.isInteger(birthHour) || birthHour < 0 || birthHour > 23) {
      throw new BadRequestException('Valid birth hour is required');
    }

    if (!Number.isInteger(birthMinute) || birthMinute < 0 || birthMinute > 59) {
      throw new BadRequestException('Valid birth minute is required');
    }

    if (!Number.isInteger(birthSecond) || birthSecond < 0 || birthSecond > 59) {
      throw new BadRequestException('Valid birth second is required');
    }

    if (!user.city?.toString().trim()) {
      throw new BadRequestException('Birth city is required for horoscope');
    }

    if (!user.countryCode?.toString().trim()) {
      throw new BadRequestException('Country code is required for horoscope');
    }
  }
  private buildNakshatraPayload(user: any) {
    this.validateDailyHoroscopeUser(user);

    return {
      subject: {
        name: user.name,

        birth_data: {
          year: Number(user.birthYear),
          month: Number(user.birthMonth),
          day: Number(user.birthDay),
          hour: Number(user.birthHour),
          minute: Number(user.birthMinute),
          second: Number(user.birthSecond || 0),

          city: user.city,
          country_code: user.countryCode,
        },
      },

      options: {
        language: 'en',
      },
    };
  }
  // =============================
  // FEATURE
  // =============================

  async getPersonalDailyHoroscope(user: any) {
    try {
      const payload = this.buildNakshatraPayload(user);

      return await this.post('/vedic/nakshatra-predictions', payload);
    } catch (error) {
      console.error('Nakshatra API Error:', error);
      throw error;
    }
  }
}
