import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { AstroParams } from '../../../../common/types/astro-params.type';
import { NumerologyParams } from '../../../../common/types/numerology-params.type';
import { NumerologyMapper } from './mapper/numerology.mapper';
import { GeoSearchParams } from '../../../../common/types/geo-search-params.type';

export type GeoSearchApiResponse = {
  status: number;
  data: unknown;
};

@Injectable()
export class VedicProvider {
  private client: AxiosInstance;
  private readonly baseUrl =
    process.env.VEDIC_BASE_URL || 'https://api.vedicastroapi.com/v3-json';
  private readonly apiKey = process.env.VEDIC_API_KEY;
  private readonly logger = new Logger(VedicProvider.name);

  constructor() {
    if (!this.apiKey) {
      throw new Error(
        'VEDIC_API_KEY is missing. Configure it in the environment before starting the service.',
      );
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000, // 🔥 prevent hanging
    });
  }

  // 🔥 COMMON REQUEST HANDLER (DRY)
  private async request(endpoint: string, params: any) {
    try {
      const response = await this.client.get(endpoint, {
        params: {
          api_key: this.apiKey,
          ...params,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `❌ Vedic API Error [${endpoint}]:`,
        error?.response?.data,
      );

      throw new HttpException(
        error?.response?.data || 'Vedic API failed',
        error?.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // 🔥 FORMAT PARAMS (IMPORTANT)
  private formatParams(params: AstroParams) {
    return {
      dob: this.formatDate(params.dob),
      tob: params.tob,
      lat: params.lat,
      lon: params.lon,
      tz: params.timezone,
      lang: params.lang || 'en',
    };
  }

  // 🔥 DATE FORMAT (YYYY-MM-DD → DD/MM/YYYY)
  private formatDate(date: string) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  // =============================
  // 🔥 FEATURES
  // =============================

  // ✅ DOSHA (Mangal Dosha)
  async getmangaldosha(params: AstroParams) {
    return this.request('/dosha/mangal-dosh', this.formatParams(params));
  }
  async getkaalsarpdosha(params: AstroParams) {
    return this.request('/dosha/kaalsarp-dosh', this.formatParams(params));
  }
  async getmanglikdosha(params: AstroParams) {
    return this.request('/dosha/manglik-dosh', this.formatParams(params));
  }

  async getpitradosha(params: AstroParams) {
    return this.request('/dosha/pitra-dosh', this.formatParams(params));
  }
  async getpapasamaya(params: AstroParams) {
    return this.request('/dosha/papasamaya', this.formatParams(params));
  }

  // ✅ DASHA (Mahadasha)
  async getmahadasha(params: AstroParams) {
    return this.request('/dashas/maha-dasha', this.formatParams(params));
  }

  async getmahadashaprediction(params: AstroParams) {
    return this.request(
      '/dashas/maha-dasha-predictions',
      this.formatParams(params),
    );
  }

  // 🔥 Gem Suggestion (READY)

  async getGemSuggestion(params: AstroParams) {
    return this.request(
      '/extended-horoscope/gem-suggestion',
      this.formatParams(params),
    );
  }

  //Sade Sati Table
  async getSadeSatiTable(params: AstroParams) {
    return this.request(
      '/extended-horoscope/extended-horoscope/sade-sati-table',
      this.formatParams(params),
    );
  }
  //Friendship table
  async getFriendshipTable(params: AstroParams) {
    return this.request(
      '/extended-horoscope/friendship-table',
      this.formatParams(params),
    );
  }

  //KP House
  async getKPHouse(params: AstroParams) {
    return this.request(
      '/extended-horoscope/kp-houses',
      this.formatParams(params),
    );
  }

  //KP Planets
  async getKPPlanets(params: AstroParams) {
    return this.request(
      '/extended-horoscope/kp-planets',
      this.formatParams(params),
    );
  }

  // 🔥 Match Compatibility
  async getMatchCompatibility(payload: any) {
    try {
      this.logger.log('📡 Calling Vedic Match API');

      const response = await axios.get(`${this.baseUrl}/matching/ashtakoot`, {
        params: {
          api_key: this.apiKey,
          ...payload, // 🔥 important
        },
      });

      this.logger.log('✅ Match API success');

      return response.data;
    } catch (error: any) {
      this.logger.error(
        '❌ Match API failed',
        error?.response?.data || error?.message,
      );

      throw new InternalServerErrorException(
        'Failed to fetch match compatibility',
      );
    }
  }
  // Numerlogy
  async getNumerology(params: NumerologyParams) {
    return this.request(
      '/prediction/numerology',
      NumerologyMapper.toApiFormat(params),
    );
  }

  // 🔥GeoSearch
  async searchGeo(params: GeoSearchParams): Promise<GeoSearchApiResponse> {
    try {
      const response = await this.client.get('/utilities/geo-search-advanced', {
        params: {
          api_key: this.apiKey,
          ...params,
        },
      });

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error: unknown) {
      const responseStatus = axios.isAxiosError(error)
        ? (error.response?.status ?? HttpStatus.BAD_GATEWAY)
        : HttpStatus.BAD_GATEWAY;
      const responseData = axios.isAxiosError(error)
        ? (error.response?.data ?? null)
        : null;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `❌ Vedic Geo API Error: status=${responseStatus} message=${errorMessage} response=${JSON.stringify(responseData)}`,
      );

      throw new HttpException(
        {
          message: 'Vedic geo API failed',
          upstreamStatus: responseStatus,
          upstreamResponse: responseData,
        },
        responseStatus,
      );
    }
  }
}
