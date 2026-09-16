import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import axios from 'axios';

import { GeoService } from './geo.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeoService', () => {
  let service: GeoService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new GeoService();

    mockedAxios.isAxiosError.mockReturnValue(false);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when city is empty', async () => {
    await expect(service.searchCity('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns an empty list when provider returns no cities', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        results: [],
      },
    } as never);

    await expect(service.searchCity('Unknown City')).resolves.toEqual({
      success: true,
      message: 'No geo suggestions found',
      data: [],
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('maps Delhi with numeric timezone and IANA timezone name', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 1273294,
              name: 'Delhi',
              latitude: 28.65195,
              longitude: 77.23149,
              country_code: 'IN',
              timezone: 'Asia/Kolkata',
              country: 'India',
              admin1: 'National Capital Territory of Delhi',
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          timezone: 'Asia/Kolkata',
          timezone_abbreviation: 'GMT+5:30',
          utc_offset_seconds: 19800,
        },
      } as never);

    await expect(service.searchCity('Delhi')).resolves.toEqual({
      success: true,
      message: 'Geo suggestions fetched successfully',
      data: [
        {
          city: 'Delhi',
          fullname: 'Delhi, National Capital Territory of Delhi, India',
          state: 'National Capital Territory of Delhi',
          countryCode: 'IN',
          country: 'India',
          latitude: 28.65195,
          longitude: 77.23149,
          timezone: 5.5,
          timezoneName: 'Asia/Kolkata',
        },
      ],
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('maps Mumbai safely', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 1275339,
              name: 'Mumbai',
              latitude: 19.07283,
              longitude: 72.88261,
              country_code: 'IN',
              timezone: 'Asia/Kolkata',
              country: 'India',
              admin1: 'Maharashtra',
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          timezone: 'Asia/Kolkata',
          timezone_abbreviation: 'GMT+5:30',
          utc_offset_seconds: 19800,
        },
      } as never);

    await expect(service.searchCity('Mumbai')).resolves.toEqual({
      success: true,
      message: 'Geo suggestions fetched successfully',
      data: [
        {
          city: 'Mumbai',
          fullname: 'Mumbai, Maharashtra, India',
          state: 'Maharashtra',
          countryCode: 'IN',
          country: 'India',
          latitude: 19.07283,
          longitude: 72.88261,
          timezone: 5.5,
          timezoneName: 'Asia/Kolkata',
        },
      ],
    });
  });

  it('supports worldwide locations and negative UTC offsets', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 5128581,
              name: 'New York',
              latitude: 40.7128,
              longitude: -74.006,
              country_code: 'US',
              timezone: 'America/New_York',
              country: 'United States',
              admin1: 'New York',
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          timezone: 'America/New_York',
          timezone_abbreviation: 'EDT',
          utc_offset_seconds: -14400,
        },
      } as never);

    await expect(service.searchCity('New York')).resolves.toEqual({
      success: true,
      message: 'Geo suggestions fetched successfully',
      data: [
        {
          city: 'New York',
          fullname: 'New York, New York, United States',
          state: 'New York',
          countryCode: 'US',
          country: 'United States',
          latitude: 40.7128,
          longitude: -74.006,
          timezone: -4,
          timezoneName: 'America/New_York',
        },
      ],
    });
  });

  it('drops a suggestion when timezone cannot be resolved', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              name: 'Delhi',
              latitude: 28.65195,
              longitude: 77.23149,
              country_code: 'IN',
              country: 'India',
              admin1: 'Delhi',
            },
          ],
        },
      } as never)
      .mockRejectedValueOnce(new Error('Timezone provider unavailable'));

    await expect(service.searchCity('Delhi')).resolves.toEqual({
      success: true,
      message: 'No usable geo suggestions found',
      data: [],
    });
  });

  it('throws service unavailable when geo provider returns 429', async () => {
    const error = {
      response: {
        status: 429,
      },
      message: 'Request failed with status code 429',
    };

    mockedAxios.get.mockRejectedValueOnce(error as never);
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(service.searchCity('Delhi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws bad gateway for unexpected upstream failure', async () => {
    const error = {
      response: {
        status: 401,
      },
      message: 'Request failed with status code 401',
    };

    mockedAxios.get.mockRejectedValueOnce(error as never);
    mockedAxios.isAxiosError.mockReturnValue(true);

    await expect(service.searchCity('Delhi')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
