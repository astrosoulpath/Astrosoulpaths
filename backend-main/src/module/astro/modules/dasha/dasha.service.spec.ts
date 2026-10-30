import {LocalVedicKundliProvider} from '../../../kundli/providers/local-vedic-kundli.provider';
import { Test, TestingModule } from '@nestjs/testing';
import { DashaService } from './dasha.service';

describe('DashaService', () => {
  let service: DashaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashaService,{provide:LocalVedicKundliProvider,useValue:{generate:jest.fn()}}],
    }).compile();

    service = module.get<DashaService>(DashaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
