import {PrismaService} from '../../../../infrastructure/prisma/prisma.service';
import {ProfileService} from '../../../profile/profile.service';
import {LocalVedicKundliProvider} from '../../../kundli/providers/local-vedic-kundli.provider';
import { Test, TestingModule } from '@nestjs/testing';
import { MatchService } from './match.service';

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchService,{provide:PrismaService,useValue:{}},{provide:ProfileService,useValue:{}},{provide:LocalVedicKundliProvider,useValue:{}}],
    }).compile();

    service = module.get<MatchService>(MatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
