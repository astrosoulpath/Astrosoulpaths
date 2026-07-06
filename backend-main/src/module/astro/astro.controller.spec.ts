import { Test, TestingModule } from '@nestjs/testing';
import { AstroController } from './astro.controller';

describe('AstroController', () => {
  let controller: AstroController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AstroController],
    }).compile();

    controller = module.get<AstroController>(AstroController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
