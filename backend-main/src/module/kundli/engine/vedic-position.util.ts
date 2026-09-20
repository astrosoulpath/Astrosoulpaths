export type VedicPosition = {
  longitude: number;
  sign: string;
  sign_no: number;
  rasi_no: number;
  degree: number;
  degree_in_sign: number;
  nakshatra: string;
  nakshatra_number: number;
  nakshatra_pada: number;
};

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

const NAKSHATRAS = [
  'Ashwini',
  'Bharani',
  'Krittika',
  'Rohini',
  'Mrigashira',
  'Ardra',
  'Punarvasu',
  'Pushya',
  'Ashlesha',
  'Magha',
  'Purva Phalguni',
  'Uttara Phalguni',
  'Hasta',
  'Chitra',
  'Swati',
  'Vishakha',
  'Anuradha',
  'Jyeshtha',
  'Mula',
  'Purva Ashadha',
  'Uttara Ashadha',
  'Shravana',
  'Dhanishta',
  'Shatabhisha',
  'Purva Bhadrapada',
  'Uttara Bhadrapada',
  'Revati',
] as const;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function mapSiderealLongitude(
  longitude: number,
): VedicPosition {
  if (!Number.isFinite(longitude)) {
    throw new Error('Invalid sidereal longitude');
  }

  const normalized = normalizeDegrees(longitude);

  const signIndex = Math.min(
    11,
    Math.floor(normalized / 30),
  );

  const degreeInSign = normalized - signIndex * 30;

  const nakshatraSize = 360 / 27;
  const padaSize = nakshatraSize / 4;

  const nakshatraIndex = Math.min(
    26,
    Math.floor(normalized / nakshatraSize),
  );

  const withinNakshatra =
    normalized - nakshatraIndex * nakshatraSize;

  const pada = Math.min(
    4,
    Math.floor(withinNakshatra / padaSize) + 1,
  );

  return {
    longitude: normalized,
    sign: RASHIS[signIndex],
    sign_no: signIndex + 1,
    rasi_no: signIndex + 1,
    degree: degreeInSign,
    degree_in_sign: degreeInSign,
    nakshatra: NAKSHATRAS[nakshatraIndex],
    nakshatra_number: nakshatraIndex + 1,
    nakshatra_pada: pada,
  };
}
