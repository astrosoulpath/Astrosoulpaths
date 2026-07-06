import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AstrologyProvider {
  private client: AxiosInstance;
  private readonly baseUrl = 'https://api.astrology-api.io/api/v3';
  private readonly apiKey = process.env.ASTRO_API_KEY;
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

  // 🔥 COMMON POST HANDLER (same pattern as your VedicProvider)
  private async post(endpoint: string, payload: any) {
    try {
      const response = await this.client.post(endpoint, payload);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `❌ Astrology API Error [${endpoint}]`,
        error?.response?.data || error.message,
      );

      throw new HttpException(
        error?.response?.data || 'Astrology API failed',
        error?.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // 🔥 PAYLOAD BUILDER (like formatParams)
  private buildNakshatraPayload(user: any) {
    return {
      subject: {
        name: user.name || 'Nakshatra Seeker',

        birth_data: {
          year: Number(user.birthYear),
          month: Number(user.birthMonth),
          day: Number(user.birthDay),
          hour: Number(user.birthHour),
          minute: Number(user.birthMinute),
          second: Number(user.birthSecond || 0),

          city: user.city || 'Delhi',
          country_code: user.countryCode || 'IN',
        },
      },

      options: {
        language: 'en',
      },
    };
  }
  // =============================
  // 🔮 FEATURE
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
