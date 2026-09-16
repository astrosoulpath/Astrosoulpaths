import { VedicDailyContextMapper } from './vedic-daily-context.mapper';

describe('VedicDailyContextMapper Tarabala', () => {
  const calculateTarabala = (
    natalNakshatraId: number | null,
    currentNakshatraId: number | null,
  ) => {
    return (VedicDailyContextMapper as any).calculateTarabala(
      natalNakshatraId,
      currentNakshatraId,
    );
  };

  it('returns Janma when natal and current Nakshatra are the same', () => {
    expect(calculateTarabala(0, 0)).toEqual(
      expect.objectContaining({
        name: 'Janma',
        count: 1,
      }),
    );
  });

  it('returns Sampat for the second Nakshatra from natal', () => {
    expect(calculateTarabala(0, 1)).toEqual(
      expect.objectContaining({
        name: 'Sampat',
        count: 2,
      }),
    );
  });

  it('handles 26 -> 0 wrap-around correctly', () => {
    expect(calculateTarabala(26, 0)).toEqual(
      expect.objectContaining({
        name: 'Sampat',
        count: 2,
      }),
    );
  });

  it('cycles every nine Nakshatras', () => {
    expect(calculateTarabala(0, 9)).toEqual(
      expect.objectContaining({
        name: 'Janma',
        count: 1,
      }),
    );

    expect(calculateTarabala(0, 17)).toEqual(
      expect.objectContaining({
        name: 'Parama Mitra',
        count: 9,
      }),
    );
  });

  it('returns null values when IDs are missing', () => {
    expect(calculateTarabala(null, 0)).toEqual({
      name: null,
      count: null,
      effect: null,
    });

    expect(calculateTarabala(0, null)).toEqual({
      name: null,
      count: null,
      effect: null,
    });
  });

  it('rejects IDs outside Prokerala zero-based 0..26 range', () => {
    expect(calculateTarabala(-1, 0)).toEqual({
      name: null,
      count: null,
      effect: null,
    });

    expect(calculateTarabala(0, 27)).toEqual({
      name: null,
      count: null,
      effect: null,
    });
  });

  it('rejects non-integer Nakshatra IDs', () => {
    expect(calculateTarabala(1.5, 2)).toEqual({
      name: null,
      count: null,
      effect: null,
    });
  });
});
