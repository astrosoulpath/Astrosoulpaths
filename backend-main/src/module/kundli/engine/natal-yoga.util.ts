export type YogaPlanet = {
  name: string;
  sign_no: number;
  house: number;
};

export type LocalNatalYoga = {
  name: string;
  has_yoga: boolean;
  calculation: string;
};

export type LocalYogaGroup = {
  group_name: string;
  yoga_list: LocalNatalYoga[];
};

function getPlanet(
  planets: YogaPlanet[],
  name: string,
): YogaPlanet {
  const planet = planets.find((item) => item.name === name);

  if (!planet) {
    throw new Error(`Planet unavailable for Yoga calculation: ${name}`);
  }

  return planet;
}

function houseDistance(
  fromSign: number,
  toSign: number,
): number {
  return ((toSign - fromSign + 12) % 12) + 1;
}

/**
 * Deterministic D1-based Vedic natal Yoga checks.
 *
 * This intentionally implements only explicitly defined rules.
 * Additional Yogas must be added individually after their rules
 * are verified; no Yoga is inferred or fabricated.
 */
export function calculateNatalYogas(
  planets: YogaPlanet[],
): LocalYogaGroup[] {
  const sun = getPlanet(planets, 'Sun');
  const moon = getPlanet(planets, 'Moon');
  const mercury = getPlanet(planets, 'Mercury');
  const mars = getPlanet(planets, 'Mars');
  const jupiter = getPlanet(planets, 'Jupiter');

  // Budha-Aditya: Sun and Mercury occupy the same Rashi.
  const budhaAditya = sun.sign_no === mercury.sign_no;

  // Chandra-Mangala: Moon and Mars occupy the same Rashi.
  const chandraMangala = moon.sign_no === mars.sign_no;

  // Gajakesari: Jupiter is in a Kendra (1/4/7/10)
  // counted from the Moon.
  const jupiterFromMoon = houseDistance(
    moon.sign_no,
    jupiter.sign_no,
  );

  const gajakesari = [1, 4, 7, 10].includes(
    jupiterFromMoon,
  );

  return [
    {
      group_name: 'Important Yogas',
      yoga_list: [
        {
          name: 'Budha-Aditya Yoga',
          has_yoga: budhaAditya,
          calculation: 'Sun and Mercury in same Rashi',
        },
        {
          name: 'Chandra-Mangala Yoga',
          has_yoga: chandraMangala,
          calculation: 'Moon and Mars in same Rashi',
        },
        {
          name: 'Gajakesari Yoga',
          has_yoga: gajakesari,
          calculation:
            'Jupiter in 1st, 4th, 7th or 10th from Moon',
        },
      ],
    },
  ];
}
