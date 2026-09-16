import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { KundliAiService } from './kundli-ai.service';
import { KundliRepository } from './kundli.repository';
import { KundliService } from './kundli.service';

describe('KundliService', () => {
  let service: KundliService;

  const repoMock = {
    findByHash: jest.fn(),
    createKundli: jest.fn(),
    findKundliData: jest.fn(),
    saveKundliData: jest.fn(),
  };

  const aiMock = {
    generateAnalysis: jest.fn(),
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const providerMock = {
    generate: jest.fn(),
  };

  const params = {
    dob: '1995-01-10',
    tob: '10:30:00',
    lat: 25.5941,
    lon: 85.1376,
    timezone: 5.5,
  };

  const completeReport = () => ({
    provider: 'vedicastro',
    status: 'COMPLETE',

    completeness: {
      corePercent: 100,
    },

    birthChart: {
      houses: [],
    },

    navamsaChart: {
      houses: [],
    },

    charts: {
      divisionalCharts: {
        D2: { chart: 'TEST_D2' },
        D3: { chart: 'TEST_D3' },
        D7: { chart: 'TEST_D7' },
        D10: { chart: 'TEST_D10' },
        D12: { chart: 'TEST_D12' },
        D60: { chart: 'TEST_D60' },
      },
    },
    planetaryPositions: [
      { name: 'Ascendant', sign: 'Pisces', degree: 5 },
      { name: 'Sun', sign: 'Sagittarius', degree: 25 },
      { name: 'Moon', sign: 'Aries', degree: 12 },
      { name: 'Mars', sign: 'Leo', degree: 8 },
      { name: 'Mercury', sign: 'Capricorn', degree: 11 },
      { name: 'Jupiter', sign: 'Scorpio', degree: 12 },
      { name: 'Venus', sign: 'Scorpio', degree: 8 },
      { name: 'Saturn', sign: 'Aquarius', degree: 15 },
      { name: 'Rahu', sign: 'Libra', degree: 17 },
      { name: 'Ketu', sign: 'Aries', degree: 17 },
    ],

    yogas: [],
    shadbala: {},
    ashtakavarga: {},

    dasha: {
      timeline: [
        {
          lord: 'Moon',
          level: 'Mahadasha',
          start: '2021-05-21',
          end: '2031-05-22',
        },
      ],
    },

    panchang: {
      tithi: 'TEST_TITHI',
    },

    dosha: {},

    analysis: {
      character: 'Existing grounded analysis',
      career: 'Existing career analysis',
      finance: 'Existing finance analysis',
      marriage: 'Existing marriage analysis',
      health: 'Existing health analysis',
      remedies: [],
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    aiMock.generateAnalysis.mockResolvedValue({
      character: 'AI character',
      career: 'AI career',
      finance: 'AI finance',
      marriage: 'AI marriage',
      health: 'AI health',
      remedies: ['Low-risk spiritual reflection'],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KundliService,

        {
          provide: KundliRepository,
          useValue: repoMock,
        },

        {
          provide: KundliAiService,
          useValue: aiMock,
        },

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: 'KUNDLI_PROVIDER',
          useValue: providerMock,
        },
      ],
    }).compile();

    service = module.get<KundliService>(KundliService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns complete cached Prokerala Kundli without calling provider or AI', async () => {
    repoMock.findByHash.mockResolvedValue({
      id: 'kundli-1',
    });

    repoMock.findKundliData.mockResolvedValue({
      vedic: {
        ...completeReport(),
        provider: 'prokerala',
      },
    });

    const result = await service.generateReport(params, 'en');

    expect(result.source).toBe('cache');

    expect(providerMock.generate).not.toHaveBeenCalled();

    expect(aiMock.generateAnalysis).not.toHaveBeenCalled();

    expect(repoMock.saveKundliData).not.toHaveBeenCalled();
  });

  it('enriches complete cached Prokerala calculation with AI when analysis is missing', async () => {
    repoMock.findByHash.mockResolvedValue({
      id: 'kundli-1',
    });

    const report = {
      ...completeReport(),
      provider: 'prokerala',
    };

    delete (report as any).analysis;

    repoMock.findKundliData.mockResolvedValue({
      vedic: report,
    });

    repoMock.saveKundliData.mockResolvedValue({
      id: 'kundli-data-1',
    });

    const result = await service.generateReport(params, 'en');

    expect(result.source).toBe('cache');

    expect(providerMock.generate).not.toHaveBeenCalled();

    expect(aiMock.generateAnalysis).toHaveBeenCalledTimes(1);

    expect(result.report.analysis.character).toBe('AI character');

    expect(repoMock.saveKundliData).toHaveBeenCalledTimes(1);
  });

  it('generates Vedic calculations first and applies AI only as interpretation', async () => {
    repoMock.findByHash.mockResolvedValue({
      id: 'kundli-1',
    });

    repoMock.findKundliData.mockResolvedValue(null);

    const providerReport = completeReport();

    delete (providerReport as any).analysis;

    providerMock.generate.mockResolvedValue(providerReport);

    repoMock.saveKundliData.mockResolvedValue({
      id: 'kundli-data-1',
    });

    const result = await service.generateReport(params, 'en');

    expect(providerMock.generate).toHaveBeenCalledWith(params, 'en');

    expect(aiMock.generateAnalysis).toHaveBeenCalledWith(providerReport);

    expect(result.report.provider).toBe('vedicastro');

    expect(result.report.analysis.character).toBe('AI character');

    expect(result.source).toBe('provider');

    expect(repoMock.saveKundliData).toHaveBeenCalledWith(
      'kundli-1',
      'en',
      expect.objectContaining({
        vedic: expect.objectContaining({
          provider: 'vedicastro',

          birthChart: providerReport.birthChart,

          navamsaChart: providerReport.navamsaChart,

          planetaryPositions: providerReport.planetaryPositions,

          analysis: expect.objectContaining({
            character: 'AI character',
          }),
        }),
      }),
    );
  });

  it('creates Kundli master record when birth-data hash does not exist', async () => {
    repoMock.findByHash.mockResolvedValueOnce(null);

    repoMock.createKundli.mockResolvedValue({
      id: 'kundli-created-1',
      hash: 'hash-created',
    });

    repoMock.findKundliData.mockResolvedValue(null);

    const providerReport = completeReport();

    delete (providerReport as any).analysis;

    providerMock.generate.mockResolvedValue(providerReport);

    repoMock.saveKundliData.mockResolvedValue({
      id: 'kundli-data-created-1',
    });

    const result = await service.generateReport(params, 'en');

    expect(repoMock.createKundli).toHaveBeenCalledTimes(1);

    expect(result.kundli.id).toBe('kundli-created-1');

    expect(result.source).toBe('provider');
  });

  it('does not accept partial historical cache as complete professional Kundli', async () => {
    repoMock.findByHash.mockResolvedValue({
      id: 'kundli-partial-1',
    });

    repoMock.findKundliData.mockResolvedValue({
      vedic: {
        provider: 'vedicastro',

        birthChart: null,
        navamsaChart: null,
        planetaryPositions: [],

        dasha: {
          timeline: [],
        },

        dosha: {},
      },
    });

    const freshReport = completeReport();

    delete (freshReport as any).analysis;

    providerMock.generate.mockResolvedValue(freshReport);

    repoMock.saveKundliData.mockResolvedValue({
      id: 'kundli-data-refreshed',
    });

    const result = await service.generateReport(params, 'en');

    expect(providerMock.generate).toHaveBeenCalledTimes(1);

    expect(result.source).toBe('provider');

    expect(result.report.birthChart).toBeTruthy();

    expect(result.report.navamsaChart).toBeTruthy();
  });
});
