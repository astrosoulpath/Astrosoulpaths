import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { AstroService } from '../astro/astro.service';
import { KundliPdfService } from '../kundli/kundli-pdf.service';
import { AiAstrologerAvatarService } from './ai-astrologer-avatar.service';

describe('ProfileService', () => {
  let service: ProfileService;
  const astro = { generateAstro: jest.fn(async (_params: any, _lang: string): Promise<any> => ({ synthetic: true })) };
  const pdf = { generateProfileKundliPdf: jest.fn(async (_input: any) => Buffer.from('%PDF-synthetic')) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfileService,
        { provide: PrismaService, useValue: {} },
        { provide: SupabaseService, useValue: {} },
        { provide: AstroService, useValue: astro },
        { provide: KundliPdfService, useValue: pdf },
        { provide: AiAstrologerAvatarService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('normalizes a new request from stored IANA zone without updating the profile', async () => {
    const profile = { birthDate:new Date('2024-01-15T00:00:00Z'),birthTime:'10:00',lat:40.7,lon:-74,timezone:-4,timezoneName:'America/New_York',lang:'en' };
    jest.spyOn(service as any,'findOwnedProfile').mockResolvedValue(profile);
    await service.generateAstro('synthetic','synthetic-profile');
    expect(astro.generateAstro.mock.calls.at(-1)?.[0].timezone).toBe(-5);
    expect(profile.timezone).toBe(-4);
  });
  it('uses the same resolved birth offset for a new PDF and its calculation', async () => {
    const profile = { birthDate:new Date('2024-01-15T00:00:00Z'),birthTime:'10:00',lat:40.7,lon:-74,timezone:-4,timezoneName:'America/New_York',lang:'en',name:'Synthetic' };
    jest.spyOn(service as any,'findOwnedProfile').mockResolvedValue(profile);
    astro.generateAstro.mockResolvedValueOnce({kundliId:'synthetic',data:{synthetic:true}});
    await service.generateAstroPdf('synthetic','synthetic-profile');
    expect(astro.generateAstro.mock.calls.at(-1)?.[0].timezone).toBe(-5);
    expect(pdf.generateProfileKundliPdf.mock.calls.at(-1)?.[0].timezone).toBe(-5);
    expect(profile.timezone).toBe(-4);
  });
});
