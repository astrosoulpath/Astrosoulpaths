import { Test, TestingModule } from '@nestjs/testing';
import { DoshaService } from './dosha.service';

describe('DoshaService', () => {
  let service: DoshaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DoshaService],
    }).compile();

    service = module.get<DoshaService>(DoshaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
