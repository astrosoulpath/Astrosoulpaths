import { TodayForYouMapper } from './today-for-you.mapper';

describe('TodayForYouMapper Cosmic Score v1', () => {
  const build = (tarabala: Record<string, unknown>) =>
    TodayForYouMapper.build({
      mappedDailyInsight: {
        cosmic: {
          overallScore: null,
        },
        lifeAreas: [],
      },
      vedicContext: {
        requestedDate: '2026-09-10',
        natal: {},
        currentMoon: {},
        transit: {
          planets: [],
        },
        dasha: {
          currentMahadasha: null,
          currentAntardasha: null,
        },
        tarabala,
      },
      panchang: {},
      ai: {},
    });

  it.each([
    ['Janma', 55],
    ['Sampat', 80],
    ['Vipat', 40],
    ['Kshema', 80],
    ['Pratyari', 40],
    ['Sadhaka', 80],
    ['Naidhana', 30],
    ['Mitra', 80],
    ['Parama Mitra', 90],
  ])('maps %s deterministically to %i', (name, score) => {
    const result = build({
      name,
      count: 1,
      effect: 'verified test effect',
    });

    expect(result.overallScore).toBe(score);
    expect(result.transparency.scoreSource).toBe(
      'vedic-calculation',
    );
  });

  it('returns null when Tarabala is unavailable', () => {
    const result = build({
      name: null,
      count: null,
      effect: null,
    });

    expect(result.overallScore).toBeNull();
    expect(result.transparency.scoreSource).toBeNull();
  });

  it('ignores an old provider overall score', () => {
    const result = TodayForYouMapper.build({
      mappedDailyInsight: {
        cosmic: {
          overallScore: 99,
        },
        lifeAreas: [],
      },
      vedicContext: {
        requestedDate: '2026-09-10',
        natal: {},
        currentMoon: {},
        transit: {
          planets: [],
        },
        dasha: {
          currentMahadasha: null,
          currentAntardasha: null,
        },
        tarabala: {
          name: 'Naidhana',
          count: 7,
          effect: 'test',
        },
      },
      panchang: {},
      ai: {},
    });

    expect(result.overallScore).toBe(30);
    expect(result.overallScore).not.toBe(99);
  });
});
