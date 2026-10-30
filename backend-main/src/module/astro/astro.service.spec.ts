import {DashaService} from './modules/dasha/dasha.service';
import {DoshaService} from './modules/dosha/dosha.service';
import {KundliService} from '../kundli/kundli.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AstroService } from './astro.service';

describe('AstroService', () => {
  let service: AstroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AstroService, {provide:DashaService,useValue:{}},{provide:DoshaService,useValue:{}},{provide:KundliService,useValue:{}}],
    }).compile();

    service = module.get<AstroService>(AstroService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
