import { Test, TestingModule } from '@nestjs/testing';
import { AstroService } from './astro.service';

describe('AstroService', () => {
  let service: AstroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AstroService],
    }).compile();

    service = module.get<AstroService>(AstroService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
