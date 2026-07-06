import { Test, TestingModule } from '@nestjs/testing';
import { DailyinsightService } from './dailyinsight.service';

describe('DailyinsightService', () => {
  let service: DailyinsightService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DailyinsightService],
    }).compile();

    service = module.get<DailyinsightService>(DailyinsightService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
