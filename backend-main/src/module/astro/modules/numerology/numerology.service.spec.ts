import { Test, TestingModule } from '@nestjs/testing';
import { NumerologyService } from './numerology.service';

describe('NumerologyService', () => {
  let service: NumerologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NumerologyService],
    }).compile();

    service = module.get<NumerologyService>(NumerologyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
