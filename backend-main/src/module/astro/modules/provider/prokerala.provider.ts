import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { AstroParams } from '../../../../common/types/astro-params.type';

type ProkeralaChartType =
  | 'rasi'
  | 'navamsa'
  | 'hora'
  | 'drekkana'
  | 'saptamsa'
  | 'dasamsa'
  | 'dwadasamsa'
  | 'shashtyamsa';

type ProkeralaMatchParams = {
  girlCoordinates: string;
  girlDob: string;
  boyCoordinates: string;
  boyDob: string;
  language?: string;
  ayanamsa?: number;
  advanced?: boolean;
};
@Injectable()
export class ProkeralaProvider {
  private readonly logger = new Logger(ProkeralaProvider.name);

  private readonly baseUrl =
    process.env.PROKERALA_BASE_URL?.trim() || 'https://api.prokerala.com/v2';

  private readonly tokenUrl =
    process.env.PROKERALA_TOKEN_URL?.trim() ||
    'https://api.prokerala.com/token';

  private readonly clientId = process.env.PROKERALA_CLIENT_ID?.trim() || '';

  private readonly clientSecret =
    process.env.PROKERALA_CLIENT_SECRET?.trim() || '';

  private readonly client: AxiosInstance;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
    });
  }

  private assertConfigured(): void {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException({
        success: false,
        code: 'PROKERALA_NOT_CONFIGURED',
        message: 'Astrology calculation provider is not configured.',
      });
    }
  }

  private async getAccessToken(): Promise<string> {
    this.assertConfigured();

    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    try {
      const body = new URLSearchParams();

      body.set('grant_type', 'client_credentials');
      body.set('client_id', this.clientId);
      body.set('client_secret', this.clientSecret);

      const response = await axios.post(this.tokenUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const token = response?.data?.access_token;
      const expiresIn = Number(response?.data?.expires_in ?? 3600);

      if (typeof token !== 'string' || token.trim() === '') {
        throw new Error('Missing access token');
      }

      this.accessToken = token;

      this.accessTokenExpiresAt = Date.now() + Math.max(expiresIn, 60) * 1000;

      return token;
    } catch (error: unknown) {
      const status = axios.isAxiosError(error)
        ? (error.response?.status ?? HttpStatus.BAD_GATEWAY)
        : HttpStatus.BAD_GATEWAY;

      this.logger.error(`prokerala.oauth.failed status=${status}`);

      throw new ServiceUnavailableException({
        success: false,
        code: 'PROKERALA_AUTH_FAILED',
        message: 'Astrology calculation provider authentication failed.',
      });
    }
  }

  private timezoneOffset(timezone: number): string {
    const sign = timezone >= 0 ? '+' : '-';

    const absolute = Math.abs(timezone);

    const hours = Math.floor(absolute);
    const minutes = Math.round((absolute - hours) * 60);

    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0',
    )}`;
  }

  private datetime(params: AstroParams): string {
    let time = params.tob.trim();

    if (/^\d{2}:\d{2}$/.test(time)) {
      time = `${time}:00`;
    }

    return `${params.dob}T${time}${this.timezoneOffset(params.timezone)}`;
  }

  private commonParams(params: AstroParams) {
    return {
      ayanamsa: 1,
      coordinates: `${params.lat},${params.lon}`,
      datetime: this.datetime(params),
      la: params.lang || 'en',
    };
  }

  private async request(
    endpoint: string,
    params: Record<string, unknown>,
    accept = 'application/json',
  ): Promise<any> {
    const token = await this.getAccessToken();

    try {
      const response = await this.client.get(endpoint, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response?.data) {
        throw new Error('Empty Prokerala response');
      }

      return response.data;
    } catch (error: unknown) {
      const upstreamStatus = axios.isAxiosError(error)
        ? (error.response?.status ?? HttpStatus.BAD_GATEWAY)
        : HttpStatus.BAD_GATEWAY;

      const upstreamData = axios.isAxiosError(error)
        ? error.response?.data
        : null;

      const safeUpstreamMessage =
        upstreamData && typeof upstreamData === 'object'
          ? JSON.stringify(upstreamData).slice(0, 1200)
          : String(upstreamData ?? '').slice(0, 1200);

      this.logger.error(
        `prokerala.request.failed endpoint=${endpoint} status=${upstreamStatus} response=${safeUpstreamMessage}`,
      );

      throw new HttpException(
        {
          success: false,
          code: 'PROKERALA_PROVIDER_ERROR',
          message: 'Astrology calculation provider request failed.',
          upstreamStatus,
        },
        upstreamStatus >= 500 ? HttpStatus.BAD_GATEWAY : upstreamStatus,
      );
    }
  }

  async getKundli(params: AstroParams) {
    return this.request('/astrology/kundli', this.commonParams(params));
  }

  async getAdvancedKundli(params: AstroParams) {
    return this.request(
      '/astrology/kundli/advanced',
      this.commonParams(params),
    );
  }

  private mapDivision(division: string): ProkeralaChartType {
    const normalized = division.trim().toUpperCase();

    const map: Record<string, ProkeralaChartType> = {
      D1: 'rasi',
      D2: 'hora',
      D3: 'drekkana',
      D7: 'saptamsa',
      D9: 'navamsa',
      D10: 'dasamsa',
      D12: 'dwadasamsa',
      D60: 'shashtyamsa',
    };

    const chart = map[normalized];

    if (!chart) {
      throw new Error(`Unsupported Prokerala divisional chart: ${division}`);
    }

    return chart;
  }

  async getDivisionalChart(params: AstroParams, division: string) {
    return this.request(
      '/astrology/chart',
      {
        ...this.commonParams(params),
        chart_type: this.mapDivision(division),
        chart_style: 'north-indian',
        format: 'svg',
      },
      'image/svg+xml',
    );
  }

  async getBirthChart(params: AstroParams) {
    return this.getDivisionalChart(params, 'D1');
  }

  async getNavamsaChart(params: AstroParams) {
    return this.getDivisionalChart(params, 'D9');
  }

  /**
   * Real Vedic divisional planet positions.
   * D1 houses use chart_type=lagna.
   * House numbers come directly from Prokerala.
   */
  async getDivisionalPlanetPositions(params: AstroParams, chartType = 'lagna') {
    return this.request('/astrology/divisional-planet-position', {
      ...this.commonParams(params),
      chart_type: chartType,
    });
  }
  async getPlanetPositions(params: AstroParams) {
    return this.request('/astrology/planet-position', {
      ...this.commonParams(params),
    });
  }

  async getPanchang(params: AstroParams) {
    return this.request('/astrology/panchang', {
      ...this.commonParams(params),
    });
  }

  async getAdvancedPanchang(params: AstroParams) {
    return this.request('/astrology/panchang/advanced', {
      ...this.commonParams(params),
    });
  }

  async getMangalDosha(params: AstroParams) {
    return this.request('/astrology/mangal-dosha', {
      ...this.commonParams(params),
    });
  }

  async getAdvancedMangalDosha(params: AstroParams) {
    return this.request('/astrology/mangal-dosha/advanced', {
      ...this.commonParams(params),
    });
  }

  async getKaalSarpDosha(params: AstroParams) {
    return this.request('/astrology/kaal-sarp-dosha', {
      ...this.commonParams(params),
    });
  }

  async getSadeSati(params: AstroParams) {
    return this.request('/astrology/sade-sati', {
      ...this.commonParams(params),
    });
  }
  async getDashaPeriods(params: AstroParams) {
    return this.request('/astrology/dasha-periods', {
      ...this.commonParams(params),
    });
  }

  async getmahadasha(params: AstroParams) {
    return this.getDashaPeriods(params);
  }

  async getYogas(params: AstroParams) {
    return this.request('/astrology/yoga', {
      ...this.commonParams(params),
    });
  }

  async getAshtakvarga(params: AstroParams) {
    return this.request('/astrology/ashtakavarga', {
      ...this.commonParams(params),

      /*
       * Prokerala Ashtakavarga requires both a target planet
       * and chart style in addition to the common birth parameters.
       *
       * Sun is the deterministic base planet used for the core
       * customer Kundli Ashtakavarga section.
       */
      planet: 0,
      chart_style: 'north-indian',
    });
  }

  async getSarvashtakavarga(params: AstroParams) {
    return this.request('/astrology/sarvashtakavarga', {
      ...this.commonParams(params),
    });
  }

  async getPapasamyam(params: AstroParams) {
    return this.request('/astrology/papasamyam', {
      ...this.commonParams(params),
    });
  }

  async getShodashvarga(params: AstroParams) {
    return this.request('/astrology/shodashvarga-chart', {
      ...this.commonParams(params),
    });
  }

  async getKPHouse(params: AstroParams) {
    return this.request('/astrology/kp/house-cusps', {
      ...this.commonParams(params),
    });
  }

  async getKundliMatching(params: ProkeralaMatchParams) {
    const endpoint = params.advanced
      ? '/astrology/kundli-matching/advanced'
      : '/astrology/kundli-matching';

    return this.request(endpoint, {
      ayanamsa: params.ayanamsa ?? 1,
      girl_coordinates: params.girlCoordinates,
      girl_dob: params.girlDob,
      boy_coordinates: params.boyCoordinates,
      boy_dob: params.boyDob,
      la: params.language ?? 'en',
    });
  }
  async getKPPlanets(params: AstroParams) {
    return this.request('/astrology/kp-planet-position', {
      ...this.commonParams(params),
    });
  }
}
