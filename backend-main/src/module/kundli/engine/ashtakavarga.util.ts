export type AshtakavargaPlanet =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn';

export type AshtakavargaContributor =
  | AshtakavargaPlanet
  | 'Ascendant';

export type AshtakavargaInput = {
  name: AshtakavargaContributor;
  sign_no: number;
};

export type BhinnaAshtakavargaResult = {
  planet: AshtakavargaPlanet;
  bindus: number[];
  total: number;
};

export type AshtakavargaResult = {
  system: 'Bhinna Ashtakavarga + Sarvashtakavarga';
  zodiac: 'sidereal';
  signs: string[];
  bhinna: BhinnaAshtakavargaResult[];
  sarvashtakavarga: {
    bindus: number[];
    total: number;
  };
};

/*
 * Classical Bhinna Ashtakavarga contribution tables.
 *
 * For each target planet, each contributor gives a bindu when
 * the target sign is at one of the listed relative houses from
 * the contributor's natal sign.
 *
 * Rahu and Ketu are intentionally not contributors in this
 * classical seven-planet + Ascendant implementation.
 */
const RULES: Record<
  AshtakavargaPlanet,
  Record<AshtakavargaContributor, number[]>
> = {
  Sun: {
    Sun:       [1, 2, 4, 7, 8, 9, 10, 11],
    Moon:      [3, 6, 10, 11],
    Mars:      [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury:   [3, 5, 6, 9, 10, 11, 12],
    Jupiter:   [5, 6, 9, 11],
    Venus:     [6, 7, 12],
    Saturn:    [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [3, 4, 6, 10, 11, 12],
  },

  Moon: {
    Sun:       [3, 6, 7, 8, 10, 11],
    Moon:      [1, 3, 6, 7, 10, 11],
    Mars:      [2, 3, 5, 6, 9, 10, 11],
    Mercury:   [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter:   [1, 4, 7, 8, 10, 11, 12],
    Venus:     [3, 4, 5, 7, 9, 10, 11],
    Saturn:    [3, 5, 6, 11],
    Ascendant: [3, 6, 10, 11],
  },

  Mars: {
    Sun:       [3, 5, 6, 10, 11],
    Moon:      [3, 6, 11],
    Mars:      [1, 2, 4, 7, 8, 10, 11],
    Mercury:   [3, 5, 6, 11],
    Jupiter:   [6, 10, 11, 12],
    Venus:     [6, 8, 11, 12],
    Saturn:    [1, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 3, 6, 10, 11],
  },

  Mercury: {
    Sun:       [5, 6, 9, 11, 12],
    Moon:      [2, 4, 6, 8, 10, 11],
    Mars:      [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury:   [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter:   [6, 8, 11, 12],
    Venus:     [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn:    [1, 2, 4, 7, 8, 9, 10, 11],
    Ascendant: [1, 2, 4, 6, 8, 10, 11],
  },

  Jupiter: {
    Sun:       [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon:      [2, 5, 7, 9, 11],
    Mars:      [1, 2, 4, 7, 8, 10, 11],
    Mercury:   [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter:   [1, 2, 3, 4, 7, 8, 10, 11],
    Venus:     [2, 5, 6, 9, 10, 11],
    Saturn:    [3, 5, 6, 12],
    Ascendant: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },

  Venus: {
    Sun:       [8, 11, 12],
    Moon:      [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars:      [3, 5, 6, 9, 11, 12],
    Mercury:   [3, 5, 6, 9, 11],
    Jupiter:   [5, 8, 9, 10, 11],
    Venus:     [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn:    [3, 4, 5, 8, 9, 10, 11],
    Ascendant: [1, 2, 3, 4, 5, 8, 9, 11],
  },

  Saturn: {
    Sun:       [1, 2, 4, 7, 8, 10, 11],
    Moon:      [3, 6, 11],
    Mars:      [3, 5, 6, 10, 11, 12],
    Mercury:   [6, 8, 9, 10, 11, 12],
    Jupiter:   [5, 6, 11, 12],
    Venus:     [6, 11, 12],
    Saturn:    [3, 5, 6, 11],
    Ascendant: [1, 3, 4, 6, 10, 11],
  },
};

const SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const TARGETS: AshtakavargaPlanet[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
];

const CONTRIBUTORS: AshtakavargaContributor[] = [
  'Sun',
  'Moon',
  'Mars',
  'Mercury',
  'Jupiter',
  'Venus',
  'Saturn',
  'Ascendant',
];

function relativeHouse(
  contributorSign: number,
  targetSign: number,
): number {
  return ((targetSign - contributorSign + 12) % 12) + 1;
}

export function calculateAshtakavarga(
  input: AshtakavargaInput[],
): AshtakavargaResult {
  const signMap = new Map<AshtakavargaContributor, number>();

  for (const item of input) {
    if (
      !Number.isInteger(item.sign_no) ||
      item.sign_no < 1 ||
      item.sign_no > 12
    ) {
      throw new Error(
        `Invalid Ashtakavarga sign for ${item.name}: ${item.sign_no}`,
      );
    }

    signMap.set(item.name, item.sign_no);
  }

  for (const contributor of CONTRIBUTORS) {
    if (!signMap.has(contributor)) {
      throw new Error(
        `Missing Ashtakavarga contributor: ${contributor}`,
      );
    }
  }

  const bhinna = TARGETS.map((targetPlanet) => {
    const bindus = Array<number>(12).fill(0);

    for (let targetSign = 1; targetSign <= 12; targetSign++) {
      let score = 0;

      for (const contributor of CONTRIBUTORS) {
        const contributorSign = signMap.get(contributor)!;

        const house = relativeHouse(
          contributorSign,
          targetSign,
        );

        if (RULES[targetPlanet][contributor].includes(house)) {
          score += 1;
        }
      }

      bindus[targetSign - 1] = score;
    }

    return {
      planet: targetPlanet,
      bindus,
      total: bindus.reduce((sum, value) => sum + value, 0),
    };
  });

  const sarvaBindus = Array<number>(12).fill(0);

  for (const chart of bhinna) {
    for (let index = 0; index < 12; index++) {
      sarvaBindus[index] += chart.bindus[index];
    }
  }

  return {
    system: 'Bhinna Ashtakavarga + Sarvashtakavarga',
    zodiac: 'sidereal',
    signs: [...SIGNS],
    bhinna,
    sarvashtakavarga: {
      bindus: sarvaBindus,
      total: sarvaBindus.reduce(
        (sum, value) => sum + value,
        0,
      ),
    },
  };
}
