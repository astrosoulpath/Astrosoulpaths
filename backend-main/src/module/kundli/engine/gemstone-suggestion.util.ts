export type GemstoneSuggestion = {
  gemstone: string;
  planet: string;
  ascendantSign: string;
  ascendantSignNo: number;
  basis: string;
  calculation: 'lagna-lord-primary-gemstone';
  disclaimer: string;
};

const LAGNA_GEMSTONE: Record<
  number,
  { planet: string; gemstone: string }
> = {
  1:  { planet: 'Mars',    gemstone: 'Red Coral' },
  2:  { planet: 'Venus',   gemstone: 'Diamond' },
  3:  { planet: 'Mercury', gemstone: 'Emerald' },
  4:  { planet: 'Moon',    gemstone: 'Pearl' },
  5:  { planet: 'Sun',     gemstone: 'Ruby' },
  6:  { planet: 'Mercury', gemstone: 'Emerald' },
  7:  { planet: 'Venus',   gemstone: 'Diamond' },
  8:  { planet: 'Mars',    gemstone: 'Red Coral' },
  9:  { planet: 'Jupiter', gemstone: 'Yellow Sapphire' },
  10: { planet: 'Saturn',  gemstone: 'Blue Sapphire' },
  11: { planet: 'Saturn',  gemstone: 'Blue Sapphire' },
  12: { planet: 'Jupiter', gemstone: 'Yellow Sapphire' },
};

export function calculateGemstoneSuggestion(
  ascendantSign: string,
  ascendantSignNo: number,
): GemstoneSuggestion {
  if (
    !Number.isInteger(ascendantSignNo) ||
    ascendantSignNo < 1 ||
    ascendantSignNo > 12
  ) {
    throw new Error(
      'Invalid ascendant sign number for gemstone suggestion.',
    );
  }

  const rule = LAGNA_GEMSTONE[ascendantSignNo];

  if (!rule) {
    throw new Error(
      'Gemstone rule unavailable for ascendant.',
    );
  }

  return {
    gemstone: rule.gemstone,
    planet: rule.planet,
    ascendantSign,
    ascendantSignNo,
    basis:
      `Primary gemstone of the Lagna lord (${rule.planet}) for ${ascendantSign} Ascendant.`,
    calculation: 'lagna-lord-primary-gemstone',
    disclaimer:
      'Traditional Jyotish guidance only; gemstone suitability may require individual astrological review.',
  };
}
