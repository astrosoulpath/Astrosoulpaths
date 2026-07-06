import { Test, TestingModule } from '@nestjs/testing';
import { KundliService } from './kundli.service';

describe('KundliService', () => {
  let service: KundliService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KundliService],
    }).compile();

    service = module.get<KundliService>(KundliService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
