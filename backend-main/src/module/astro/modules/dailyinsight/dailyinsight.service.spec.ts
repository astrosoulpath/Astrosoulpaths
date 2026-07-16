import { Test, TestingModule } from '@nestjs/testing';

import { AstrologyProvider } from '../provider/astrologyapi.provider';
import { NakshatraDailyInsightService } from './dailyinsight.service';

describe('NakshatraDailyInsightService', () => {
  let service: NakshatraDailyInsightService;

  const astrologyProviderMock = {
    getPersonalDailyHoroscope: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NakshatraDailyInsightService,
        {
          provide: AstrologyProvider,
          useValue: astrologyProviderMock,
        },
      ],
    }).compile();

    service = module.get<NakshatraDailyInsightService>(
      NakshatraDailyInsightService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});