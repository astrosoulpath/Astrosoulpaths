import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GeoService } from './geo.service';
import { VedicProvider } from '../provider/vedic.provider';

type MockVedicProvider = {
  searchGeo: jest.Mock<() => Promise<unknown>>;
};

describe('GeoService', () => {
  let service: GeoService;
  let vedicProvider: MockVedicProvider;

  beforeEach(async () => {
    vedicProvider = {
      searchGeo: jest.fn<() => Promise<unknown>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        {
          provide: VedicProvider,
          useValue: vedicProvider as unknown as VedicProvider,
        },
      ],
    }).compile();

    service = module.get<GeoService>(GeoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('maps valid geo results safely', async () => {
    vedicProvider.searchGeo.mockResolvedValue({
      status: 200,
      data: {
        response: [
          {
            name: 'Delhi',
            alternate_name: 'New Delhi',
            state_name: 'Delhi',
            country: 'IN',
            country_name: 'India',
            coordinates: ['28.6139', '77.2090'],
            tz: 'Asia/Kolkata',
            tzone: 'India Standard Time',
          },
        ],
      },
    });

    await expect(service.searchCity('Delhi')).resolves.toEqual({
      success: true,
      message: 'Geo suggestions fetched successfully',
      data: [
        {
          city: 'Delhi',
          fullname: 'New Delhi',
          state: 'Delhi',
          countryCode: 'IN',
          country: 'India',
          latitude: 28.6139,
          longitude: 77.209,
          timezone: 'Asia/Kolkata',
          timezoneName: 'India Standard Time',
        },
      ],
    });
  });

  it('maps a single geo object with lat lon fields safely', async () => {
    vedicProvider.searchGeo.mockResolvedValue({
      status: 200,
      data: {
        response: {
          city: 'Mumbai',
          fullname: 'Mumbai, Maharashtra, India',
          state: 'Maharashtra',
          country_code: 'IN',
          country_name: 'India',
          lat: '19.076',
          lon: '72.8777',
          timezone: 'Asia/Kolkata',
          timezone_name: 'India Standard Time',
        },
      },
    });

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
          latitude: 19.076,
          longitude: 72.8777,
          timezone: 'Asia/Kolkata',
          timezoneName: 'India Standard Time',
        },
      ],
    });
  });

  it('returns a safe empty response for upstream error payloads', async () => {
    vedicProvider.searchGeo.mockResolvedValue({
      status: 200,
      data: {
        success: false,
        message: 'Unauthorized API key',
      },
    });

    await expect(service.searchCity('Delhi')).resolves.toEqual({
      success: true,
      message: 'Unauthorized API key',
      data: [],
    });
  });

  it('returns a safe empty response for unexpected payload shapes', async () => {
    vedicProvider.searchGeo.mockResolvedValue({
      status: 200,
      data: {
        foo: 'bar',
      },
    });

    await expect(service.searchCity('Delhi')).resolves.toEqual({
      success: true,
      message: 'Geo provider returned an unexpected response format',
      data: [],
    });
  });

  it('throws a service unavailable error for upstream rate limiting', async () => {
    vedicProvider.searchGeo.mockRejectedValue(
      new HttpException(
        {
          message: 'Vedic geo API failed',
          upstreamStatus: 429,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(service.searchCity('Delhi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws an internal server error for upstream auth failures', async () => {
    vedicProvider.searchGeo.mockRejectedValue(
      new HttpException(
        {
          message: 'Vedic geo API failed',
          upstreamStatus: 401,
        },
        HttpStatus.UNAUTHORIZED,
      ),
    );

    await expect(service.searchCity('Delhi')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
