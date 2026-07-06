import { Test, TestingModule } from '@nestjs/testing';
import { DoshaController } from './dosha.controller';

describe('DoshaController', () => {
  let controller: DoshaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoshaController],
    }).compile();

    controller = module.get<DoshaController>(DoshaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
