import { Test, TestingModule } from '@nestjs/testing';
import { DashaController } from './dasha.controller';

describe('DashaController', () => {
  let controller: DashaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashaController],
    }).compile();

    controller = module.get<DashaController>(DashaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
