import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  HttpException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { VedicProvider } from '../provider/vedic.provider';

type GeoApiRecord = Record<string, unknown>;

type GeoSuggestion = {
  city: string | null;
  fullname: string | null;
  state: string | null;
  countryCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  timezoneName: string | null;
};

type GeoSearchResult = {
  success: true;
  message: string;
  data: GeoSuggestion[];
};

type GeoProviderResponse = {
  status: number;
  data: unknown;
};

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly vedicProvider: VedicProvider) {}

  async searchCity(city: string): Promise<GeoSearchResult> {
    try {
      // Sanitize input early so downstream providers do not receive malformed values.
      const sanitizedCity = city.trim();

      if (!sanitizedCity) {
        throw new BadRequestException('City is required');
      }

      this.logger.log(`Searching geo suggestions for city="${sanitizedCity}"`);

      const rawResponse: unknown = await this.vedicProvider.searchGeo({
        city: sanitizedCity,
      });
      const response = this.normalizeProviderResponse(rawResponse);
      this.logGeoApiResponse(sanitizedCity, response);

      const upstreamErrorMessage = this.extractUpstreamErrorMessage(
        response.data,
      );
      if (upstreamErrorMessage) {
        this.logger.warn(
          `Geo API returned an error payload for city="${sanitizedCity}": ${upstreamErrorMessage}`,
        );

        return {
          success: true,
          message: upstreamErrorMessage,
          data: [],
        };
      }

      const results = this.extractResults(response.data);
      if (!results) {
        // Defensive fallback for provider payload drift across environments.
        this.logger.warn(
          `Unexpected geo API payload for city="${sanitizedCity}": ${this.safeSerialize(response.data)}`,
        );

        return {
          success: true,
          message: 'Geo provider returned an unexpected response format',
          data: [],
        };
      }

      if (results.length === 0) {
        return {
          success: true,
          message: 'No geo suggestions found',
          data: [],
        };
      }

      const transformed = results.map((item) => this.mapSuggestion(item));

      return {
        success: true,
        message: 'Geo suggestions fetched successfully',
        data: transformed,
      };
    } catch (error: unknown) {
      this.logSearchError(city, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof HttpException) {
        const status = error.getStatus();
        const payload = error.getResponse();

        if (status === 401 || status === 403) {
          throw new InternalServerErrorException(
            'Geo provider authentication failed',
          );
        }

        if (status === 429) {
          throw new ServiceUnavailableException(
            'Geo provider rate limit exceeded. Try again later.',
          );
        }

        if (status >= 500) {
          throw new BadGatewayException(
            'Geo provider is currently unavailable',
          );
        }

        throw new HttpException(payload, status);
      }

      throw new InternalServerErrorException('Failed to fetch geo suggestions');
    }
  }

  private logGeoApiResponse(city: string, response: GeoProviderResponse): void {
    this.logger.log(
      `Geo API response for city="${city}": status=${response.status} body=${this.safeSerialize(response.data)}`,
    );
  }

  private logSearchError(city: string, error: unknown): void {
    if (error instanceof HttpException) {
      this.logger.error(
        `Geo search failed for city="${city}": status=${error.getStatus()} response=${this.safeSerialize(error.getResponse())}`,
      );
      return;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Geo search failed for city="${city}": ${message}`);
  }

  private normalizeProviderResponse(value: unknown): GeoProviderResponse {
    const record = this.asRecord(value);

    return {
      status: typeof record?.status === 'number' ? record.status : 0,
      data: record?.data ?? value,
    };
  }

  private extractResults(payload: unknown): GeoApiRecord[] | null {
    return this.extractResultsFromCandidate(payload);
  }

  private extractUpstreamErrorMessage(payload: unknown): string | null {
    const record = this.asRecord(payload);
    if (!record) {
      return null;
    }

    const message =
      this.asString(record.message) ?? this.asString(record.error);
    const success = record.success;
    const hasErrorPayload = Boolean(record.error || record.errors);

    if (success === false && message) {
      return message;
    }

    if (hasErrorPayload && message) {
      return message;
    }

    return null;
  }

  private mapSuggestion(item: GeoApiRecord): GeoSuggestion {
    const coordinates = Array.isArray(item.coordinates) ? item.coordinates : [];
    const latitude =
      this.toNullableNumber(item.lat) ??
      this.toNullableNumber(item.latitude) ??
      this.toNullableNumber(coordinates[0]);
    const longitude =
      this.toNullableNumber(item.lon) ??
      this.toNullableNumber(item.lng) ??
      this.toNullableNumber(item.longitude) ??
      this.toNullableNumber(coordinates[1]);

    return {
      city: this.asString(item.name) ?? this.asString(item.city),
      fullname:
        this.asString(item.alternate_name) ?? this.asString(item.fullname),
      state: this.asString(item.state_name) ?? this.asString(item.state),
      countryCode:
        this.asString(item.country_code) ?? this.asString(item.country),
      country: this.asString(item.country_name),
      latitude,
      longitude,
      timezone: this.asString(item.tz) ?? this.asString(item.timezone),
      timezoneName:
        this.asString(item.tzone) ?? this.asString(item.timezone_name),
    };
  }

  private extractResultsFromCandidate(value: unknown): GeoApiRecord[] | null {
    const directArray = this.asRecordArray(value);
    if (directArray && directArray.length > 0) {
      return directArray;
    }

    const record = this.asRecord(value);
    if (!record) {
      return directArray;
    }

    if (this.looksLikeGeoRecord(record)) {
      return [record];
    }

    const candidates = [
      record.response,
      record.data,
      record.results,
      record.payload,
      record.result,
      record.location,
      record.locations,
      record.suggestion,
      record.suggestions,
    ];

    for (const candidate of candidates) {
      const extracted = this.extractResultsFromCandidate(candidate);
      if (extracted && extracted.length > 0) {
        return extracted;
      }
    }

    return null;
  }

  private looksLikeGeoRecord(record: GeoApiRecord): boolean {
    return Boolean(
      this.asString(record.name) ??
      this.asString(record.city) ??
      this.toNullableNumber(record.lat) ??
      this.toNullableNumber(record.latitude) ??
      this.toNullableNumber(record.lon) ??
      this.toNullableNumber(record.lng) ??
      this.toNullableNumber(record.longitude) ??
      (Array.isArray(record.coordinates)
        ? record.coordinates.length > 0
        : false),
    );
  }

  private asRecord(value: unknown): GeoApiRecord | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as GeoApiRecord)
      : null;
  }

  private asRecordArray(value: unknown): GeoApiRecord[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    return value
      .map((item) => this.asRecord(item))
      .filter((item): item is GeoApiRecord => item !== null);
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private safeSerialize(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable payload]';
    }
  }
}
