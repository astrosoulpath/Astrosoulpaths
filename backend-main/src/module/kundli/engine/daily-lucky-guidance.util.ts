export type DailyLuckyGuidance = {
  planet: string;
  color: string;
  number: number;
  calculation: string;
};

const NAKSHATRA_LORDS = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
] as const;

const PLANET_GUIDANCE: Record<
  (typeof NAKSHATRA_LORDS)[number],
  { color: string; number: number }
> = {
  Sun: { color: 'Orange', number: 1 },
  Moon: { color: 'White', number: 2 },
  Jupiter: { color: 'Yellow', number: 3 },
  Rahu: { color: 'Smoky Blue', number: 4 },
  Mercury: { color: 'Green', number: 5 },
  Venus: { color: 'White', number: 6 },
  Ketu: { color: 'Brown', number: 7 },
  Saturn: { color: 'Dark Blue', number: 8 },
  Mars: { color: 'Red', number: 9 },
};

export function calculateDailyLuckyGuidance(
  currentNakshatraNumber: number,
): DailyLuckyGuidance {
  if (
    !Number.isInteger(currentNakshatraNumber) ||
    currentNakshatraNumber < 1 ||
    currentNakshatraNumber > 27
  ) {
    throw new Error('Current nakshatra number must be an integer from 1 to 27.');
  }

  const planet =
    NAKSHATRA_LORDS[(currentNakshatraNumber - 1) % NAKSHATRA_LORDS.length];

  const guidance = PLANET_GUIDANCE[planet];

  return {
    planet,
    color: guidance.color,
    number: guidance.number,
    calculation: 'current-nakshatra-vimshottari-lord',
  };
}
