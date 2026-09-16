import { Test, TestingModule } from '@nestjs/testing';

import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

describe('GeoController', () => {
  let controller: GeoController;

  const geoServiceMock = {
    searchCity: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoController],
      providers: [
        {
          provide: GeoService,
          useValue: geoServiceMock,
        },
      ],
    }).compile();

    controller = module.get<GeoController>(GeoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call GeoService.searchCity with dto city', async () => {
    const serviceResponse = {
      success: true,
      message: 'Geo suggestions fetched successfully',
      data: [
        {
          city: 'Kanpur',
          fullname: 'Kanpur, Uttar Pradesh, India',
          state: 'Uttar Pradesh',
          countryCode: 'IN',
          country: 'India',
          latitude: 26.46523,
          longitude: 80.34975,
          timezone: 5.5,
          timezoneName: 'Asia/Kolkata',
        },
      ],
    };

    geoServiceMock.searchCity.mockResolvedValue(serviceResponse);

    await expect(
      controller.searchCity({
        city: 'Kanpur',
      }),
    ).resolves.toEqual(serviceResponse);

    expect(geoServiceMock.searchCity).toHaveBeenCalledTimes(1);
    expect(geoServiceMock.searchCity).toHaveBeenCalledWith('Kanpur');
  });
});
