const RASHIS = [
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
] as const;

export type NavamsaPosition = {
  longitude: number;
  sign: string;
  sign_no: number;
  degree: number;
};

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Calculate D9/Navamsa position from a sidereal D1 longitude.
 *
 * Each Navamsa = 3°20'.
 * Equivalent zodiac mapping:
 * D9 longitude = sidereal longitude * 9 (mod 360).
 */
export function calculateNavamsaPosition(
  siderealLongitude: number,
): NavamsaPosition {
  if (!Number.isFinite(siderealLongitude)) {
    throw new Error(
      'Sidereal longitude must be a finite number.',
    );
  }

  const d9Longitude = normalizeDegrees(
    normalizeDegrees(siderealLongitude) * 9,
  );

  const signIndex = Math.floor(d9Longitude / 30);

  return {
    longitude: d9Longitude,
    sign: RASHIS[signIndex],
    sign_no: signIndex + 1,
    degree: d9Longitude % 30,
  };
}
