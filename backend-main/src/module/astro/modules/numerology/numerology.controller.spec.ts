import { Test, TestingModule } from '@nestjs/testing';
import { NumerologyController } from './numerology.controller';

describe('NumerologyController', () => {
  let controller: NumerologyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NumerologyController],
    }).compile();

    controller = module.get<NumerologyController>(NumerologyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
