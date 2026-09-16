import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

type OpenMeteoGeoResult = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  admin1_id?: number;
  admin2_id?: number;
  admin3_id?: number;
  admin4_id?: number;
  timezone?: string;
  population?: number;
  postcodes?: string[];
  country_id?: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
};

type OpenMeteoGeoResponse = {
  results?: OpenMeteoGeoResult[];
  generationtime_ms?: number;
};

type OpenMeteoTimezoneResponse = {
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
};

type GeoSuggestion = {
  city: string;
  fullname: string;
  state: string;
  countryCode: string;
  country: string;
  latitude: number;
  longitude: number;

  /*
   * Frontend/Kundli currently expects
   * numeric UTC offset, e.g. India = 5.5
   */
  timezone: number;

  /*
   * IANA timezone name, e.g.
   * Asia/Kolkata
   */
  timezoneName: string;
};

type GeoSearchResult = {
  success: true;
  message: string;
  data: GeoSuggestion[];
};

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  /*
   * Keep this configurable for production.
   *
   * Local/dev default:
   * https://geocoding-api.open-meteo.com/v1
   */
  private readonly geocodingBaseUrl =
    process.env.GEO_BASE_URL?.trim() ||
    'https://geocoding-api.open-meteo.com/v1';

  private readonly weatherBaseUrl =
    process.env.GEO_TIMEZONE_BASE_URL?.trim() ||
    'https://api.open-meteo.com/v1';

  async searchCity(city: string): Promise<GeoSearchResult> {
    const sanitizedCity = city?.trim();

    if (!sanitizedCity) {
      throw new BadRequestException('City is required');
    }

    try {
      this.logger.log(`Searching geo suggestions for city="${sanitizedCity}"`);

      const response = await axios.get<OpenMeteoGeoResponse>(
        `${this.geocodingBaseUrl}/search`,
        {
          params: {
            name: sanitizedCity,
            count: 10,
            language: 'en',
            format: 'json',
          },

          timeout: 7000,
        },
      );

      const results = Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      if (!results.length) {
        return {
          success: true,
          message: 'No geo suggestions found',
          data: [],
        };
      }

      /*
       * Resolve suggestions independently.
       *
       * Promise.allSettled prevents one bad
       * location/timezone lookup from killing
       * every result.
       */
      const resolved = await Promise.allSettled(
        results.map((item) => this.mapSuggestion(item)),
      );

      const suggestions = resolved
        .filter(
          (item): item is PromiseFulfilledResult<GeoSuggestion | null> =>
            item.status === 'fulfilled',
        )
        .map((item) => item.value)
        .filter((item): item is GeoSuggestion => item !== null);

      if (!suggestions.length) {
        this.logger.warn(
          `Geo provider returned results but none were usable for city="${sanitizedCity}"`,
        );

        return {
          success: true,
          message: 'No usable geo suggestions found',
          data: [],
        };
      }

      this.logger.log(
        `Geo search successful for city="${sanitizedCity}" results=${suggestions.length}`,
      );

      return {
        success: true,
        message: 'Geo suggestions fetched successfully',
        data: suggestions,
      };
    } catch (error: unknown) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      const message =
        error instanceof Error ? error.message : 'Unknown geo provider error';

      this.logger.error(
        `Geo search failed for city="${sanitizedCity}": status=${
          status ?? 'unknown'
        } message=${message}`,
      );

      if (status === 429) {
        throw new ServiceUnavailableException(
          'Geo provider rate limit exceeded. Try again later.',
        );
      }

      if (status && status >= 500) {
        throw new BadGatewayException('Geo provider is currently unavailable');
      }

      if (axios.isAxiosError(error)) {
        throw new BadGatewayException('Unable to resolve location right now');
      }

      throw new InternalServerErrorException('Failed to fetch geo suggestions');
    }
  }

  private async mapSuggestion(
    item: OpenMeteoGeoResult,
  ): Promise<GeoSuggestion | null> {
    const city = item.name?.trim() || null;

    const latitude = typeof item.latitude === 'number' ? item.latitude : null;

    const longitude =
      typeof item.longitude === 'number' ? item.longitude : null;

    if (!city || latitude === null || longitude === null) {
      return null;
    }

    const timezoneDetails = await this.resolveTimezoneDetails(
      latitude,
      longitude,
      item.timezone,
    );

    /*
     * Profile validation requires both:
     *
     * timezone numeric offset
     * timezoneName IANA identifier
     */
    if (timezoneDetails === null) {
      return null;
    }

    const state = item.admin1?.trim() || '';

    const country = item.country?.trim() || '';

    const countryCode = item.country_code?.trim().toUpperCase() || '';

    const fullname = [city, state, country]
      .filter((value) => Boolean(value))
      .join(', ');

    return {
      city,

      fullname: fullname || city,

      state,

      countryCode,

      country,

      latitude,

      longitude,

      timezone: timezoneDetails.offset,

      timezoneName: timezoneDetails.name,
    };
  }

  private async resolveTimezoneDetails(
    latitude: number,
    longitude: number,
    fallbackTimezone?: string,
  ): Promise<{
    offset: number;
    name: string;
  } | null> {
    try {
      const response = await axios.get<OpenMeteoTimezoneResponse>(
        `${this.weatherBaseUrl}/forecast`,
        {
          params: {
            latitude,
            longitude,

            /*
             * Tells provider to determine
             * timezone from coordinates.
             */
            timezone: 'auto',

            forecast_days: 1,
          },

          timeout: 7000,
        },
      );

      const seconds =
        typeof response.data?.utc_offset_seconds === 'number'
          ? response.data.utc_offset_seconds
          : null;

      const timezoneName =
        response.data?.timezone?.trim() || fallbackTimezone?.trim() || null;

      if (seconds === null || !timezoneName) {
        this.logger.warn(
          `Incomplete timezone response for lat=${latitude}, lon=${longitude}`,
        );

        return null;
      }

      /*
       * Examples:
       *
       * India:
       * 19800 / 3600 = 5.5
       *
       * New York:
       * -14400 / 3600 = -4
       */
      const offset = Number((seconds / 3600).toFixed(2));

      return {
        offset,
        name: timezoneName,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown timezone error';

      this.logger.warn(
        `Timezone lookup failed for lat=${latitude}, lon=${longitude}: ${message}`,
      );

      /*
       * Do NOT silently return timezone=0.
       *
       * 0 would look like valid UTC data and
       * could generate incorrect astrology
       * calculations.
       */
      return null;
    }
  }
}
