import { Test, TestingModule } from '@nestjs/testing';
import { DailyinsightController } from './dailyinsight.controller';

describe('DailyinsightController', () => {
  let controller: DailyinsightController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DailyinsightController],
    }).compile();

    controller = module.get<DailyinsightController>(DailyinsightController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
