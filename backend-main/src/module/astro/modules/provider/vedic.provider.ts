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
import { VedicEndpoints } from './config/vedic-endpoints';

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
      timeout: 5000, // prevent hanging
    });
  }
  // COMMON REQUEST HANDLER (DRY)
  private async request(endpoint: string, params: any) {
    try {
      const response = await this.client.get(endpoint, {
        params: {
          api_key: this.apiKey,
          ...params,
        },
      });

      const body = response?.data;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_INVALID_RESPONSE',
            message:
              'Astrology calculation provider returned an invalid response.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      const providerStatus = Number(body.status);

      if (!Number.isFinite(providerStatus)) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_INVALID_STATUS',
            message:
              'Astrology calculation provider returned an invalid status.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (providerStatus !== 200) {
        this.logger.warn(
          `vedic.request.rejected endpoint=${endpoint} providerStatus=${providerStatus}`,
        );

        throw new HttpException(
          {
            success: false,
            code:
              providerStatus === 402
                ? 'VEDIC_PROVIDER_QUOTA_UNAVAILABLE'
                : 'VEDIC_PROVIDER_REQUEST_FAILED',
            message:
              providerStatus === 402
                ? 'Astrology calculation service is temporarily unavailable.'
                : 'Astrology calculation provider could not complete the request.',
            providerStatus,
          },
          providerStatus === 402
            ? HttpStatus.SERVICE_UNAVAILABLE
            : HttpStatus.BAD_GATEWAY,
        );
      }

      if (body.response === null || body.response === undefined) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_EMPTY_RESPONSE',
            message:
              'Astrology calculation provider returned no calculation data.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      return body.response;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const upstreamStatus = Number(error?.response?.status);

      this.logger.error(
        `vedic.request.transport_failed endpoint=${endpoint} httpStatus=${
          Number.isFinite(upstreamStatus) ? upstreamStatus : 'unknown'
        }`,
      );

      throw new HttpException(
        {
          success: false,
          code: 'VEDIC_PROVIDER_TRANSPORT_FAILED',
          message: 'Astrology calculation service could not be reached.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
  private formatParams(params: AstroParams) {
    return {
      dob: this.formatDate(params.dob),
      tob: params.tob.trim().slice(0, 5),
      lat: params.lat,
      lon: params.lon,
      tz: params.timezone,
      lang: params.lang || 'en',
    };
  }
  // DATE FORMAT (YYYY-MM-DD -> DD/MM/YYYY)
  private formatDate(date: string) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  // =============================
  // FEATURES
  // =============================
  // DOSHA (Mangal Dosha)
  async getmangaldosha(params: AstroParams) {
    return this.request(VedicEndpoints.dosha.mangal, this.formatParams(params));
  }
  async getkaalsarpdosha(params: AstroParams) {
    return this.request(
      VedicEndpoints.dosha.kaalSarp,
      this.formatParams(params),
    );
  }
  async getmanglikdosha(params: AstroParams) {
    return this.request(
      VedicEndpoints.dosha.manglik,
      this.formatParams(params),
    );
  }

  async getpitradosha(params: AstroParams) {
    return this.request(VedicEndpoints.dosha.pitra, this.formatParams(params));
  }
  async getpapasamaya(params: AstroParams) {
    return this.request(
      VedicEndpoints.dosha.papaSamaya,
      this.formatParams(params),
    );
  }
  // DASHA (Mahadasha)
  async getmahadasha(params: AstroParams) {
    return this.request(
      VedicEndpoints.dasha.mahaDasha,
      this.formatParams(params),
    );
  }

  async getmahadashaprediction(params: AstroParams) {
    return this.request(
      VedicEndpoints.dasha.mahaDashaPrediction,
      this.formatParams(params),
    );
  }
  // Gem Suggestion (READY)
  async getGemSuggestion(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.gemSuggestion,
      this.formatParams(params),
    );
  }

  //Sade Sati Table
  async getSadeSatiTable(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.sadeSati,
      this.formatParams(params),
    );
  }
  //Friendship table
  async getFriendshipTable(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.friendship,
      this.formatParams(params),
    );
  }

  //KP House
  async getKPHouse(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.kpHouses,
      this.formatParams(params),
    );
  }

  //KP Planets
  async getKPPlanets(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.kpPlanets,
      this.formatParams(params),
    );
  }
  // Match Compatibility
  async getMatchCompatibility(payload: any) {
    try {
      this.logger.log('Calling Vedic Match API');

      const response = await axios.get(`${this.baseUrl}/matching/ashtakoot`, {
        params: {
          api_key: this.apiKey,
          ...payload, // important
        },
      });

      this.logger.log('Match API success');

      const body = response?.data;

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_INVALID_RESPONSE',
            message: 'Compatibility provider returned an invalid response.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      const providerStatus = Number(body.status);

      if (!Number.isFinite(providerStatus)) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_INVALID_STATUS',
            message: 'Compatibility provider returned an invalid status.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (providerStatus !== 200) {
        this.logger.warn(
          `vedic.match.rejected providerStatus=${providerStatus}`,
        );

        throw new HttpException(
          {
            success: false,
            code:
              providerStatus === 402
                ? 'VEDIC_PROVIDER_QUOTA_UNAVAILABLE'
                : 'VEDIC_PROVIDER_REQUEST_FAILED',
            message:
              providerStatus === 402
                ? 'Astrology calculation service is temporarily unavailable.'
                : 'Compatibility calculation could not be completed.',
            providerStatus,
          },
          providerStatus === 402
            ? HttpStatus.SERVICE_UNAVAILABLE
            : HttpStatus.BAD_GATEWAY,
        );
      }

      if (body.response === null || body.response === undefined) {
        throw new HttpException(
          {
            success: false,
            code: 'VEDIC_PROVIDER_EMPTY_RESPONSE',
            message: 'Compatibility provider returned no calculation data.',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }

      return body.response;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        'Match API failed',
        error?.response?.data || error?.message,
      );

      throw new InternalServerErrorException(
        'Failed to fetch match compatibility',
      );
    }
  }

  async getDivisionalChart(params: AstroParams, division: string) {
    const normalizedDivision = division.trim().toUpperCase();

    if (!/^D(?:[1-9]|[1-5][0-9]|60)$/.test(normalizedDivision)) {
      throw new Error(`Unsupported divisional chart: ${division}`);
    }

    return this.request('/horoscope/divisional-charts', {
      ...this.formatParams(params),
      div: normalizedDivision,
      response_type: 'planet_object',
    });
  }

  async getBirthChart(params: AstroParams) {
    return this.getDivisionalChart(params, 'D1');
  }

  async getNavamsaChart(params: AstroParams) {
    return this.getDivisionalChart(params, 'D9');
  }

  async getPlanetPositions(params: AstroParams) {
    return this.request(
      VedicEndpoints.horoscope.planetPositions,
      this.formatParams(params),
    );
  }

  async getYogas(params: AstroParams) {
    return this.request(
      VedicEndpoints.extended.yogaList,
      this.formatParams(params),
    );
  }
  async getShadbala(params: AstroParams) {
    return this.request(
      '/extended-horoscope/shad-bala',
      this.formatParams(params),
    );
  }
  async getAshtakvarga(params: AstroParams) {
    return this.request('/horoscope/ashtakvarga', this.formatParams(params));
  }
  async getPanchang(params: AstroParams) {
    const formatted = this.formatParams(params);

    return this.request('/panchang/panchang', {
      date: formatted.dob,
      time: formatted.tob.slice(0, 5),
      lat: formatted.lat,
      lon: formatted.lon,
      tz: formatted.tz,
      lang: formatted.lang,
    });
  }

  // Numerlogy
  async getNumerology(params: NumerologyParams) {
    return this.request(
      VedicEndpoints.prediction.numerology,
      NumerologyMapper.toApiFormat(params),
    );
  }
  // GeoSearch
  async searchGeo(params: GeoSearchParams): Promise<GeoSearchApiResponse> {
    try {
      const response = await this.client.get(
        VedicEndpoints.utilities.geoSearch,
        {
          params: {
            api_key: this.apiKey,
            ...params,
          },
        },
      );

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
        `Vedic Geo API Error: status=${responseStatus} message=${errorMessage} response=${JSON.stringify(responseData)}`,
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
