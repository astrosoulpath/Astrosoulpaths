import { LocalVedicKundliProvider } from './local-vedic-kundli.provider';

describe('LocalVedicKundliProvider KP runtime', () => {
  it('generates real KP houses and planets with star/sub lords', async () => {
    const provider = new LocalVedicKundliProvider();

    const report = await provider.generate(
      {
        dob: '1995-08-15',
        tob: '10:30',
        lat: 25.5941,
        lon: 85.1376,
        timezone: 5.5,
      },
      'en',
    );

    const kp = report.kp as {
      houses?: Array<{
        house: number;
        longitude: number;
        starLord: string;
        subLord: string;
      }>;
      planets?: Array<{
        name: string;
        longitude: number;
        starLord: string;
        subLord: string;
      }>;
    };

    console.log(
      'KP_RUNTIME_RESULT=',
      JSON.stringify(
        {
          provider: report.provider,
          houseCount: kp?.houses?.length,
          planetCount: kp?.planets?.length,
          firstHouse: kp?.houses?.[0],
          firstPlanet: kp?.planets?.[0],
        },
        null,
        2,
      ),
    );

    expect(report.provider).toBe('local-vedic');

    expect(kp?.houses).toHaveLength(12);
    expect((kp?.planets?.length ?? 0)).toBeGreaterThan(0);

    for (const house of kp?.houses ?? []) {
      expect(Number.isFinite(house.longitude)).toBe(true);
      expect(house.starLord).toBeTruthy();
      expect(house.subLord).toBeTruthy();
    }

    for (const planet of kp?.planets ?? []) {
      expect(Number.isFinite(planet.longitude)).toBe(true);
      expect(planet.starLord).toBeTruthy();
      expect(planet.subLord).toBeTruthy();
    }
  });
});
