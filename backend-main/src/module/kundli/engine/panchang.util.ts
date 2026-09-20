const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashirsha',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
  'Svati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada',
  'Revati',
] as const;

const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
  'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda',
  'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
  'Indra', 'Vaidhriti',
] as const;

const TITHIS = [
  'Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi',
  'Purnima',
  'Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi',
  'Amavasya',
] as const;

const MOVABLE_KARANAS = [
  'Bava',
  'Balava',
  'Kaulava',
  'Taitila',
  'Garaja',
  'Vanija',
  'Vishti',
] as const;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function calculateKarana(halfTithiIndex: number): string {
  // 60 half-tithis in one lunar month.
  // #1 Kimstughna; #2..#57 seven movable Karanas repeated;
  // #58 Shakuni; #59 Chatushpada; #60 Naga.
  if (halfTithiIndex === 0) {
    return 'Kimstughna';
  }

  if (halfTithiIndex >= 57) {
    return ['Shakuni', 'Chatushpada', 'Naga'][
      halfTithiIndex - 57
    ];
  }

  return MOVABLE_KARANAS[(halfTithiIndex - 1) % 7];
}

export function calculatePanchang(
  sunSiderealLongitude: number,
  moonSiderealLongitude: number,
  utcDate: Date,
) {
  if (
    !Number.isFinite(sunSiderealLongitude) ||
    !Number.isFinite(moonSiderealLongitude)
  ) {
    throw new Error(
      'Invalid Sun/Moon longitude for Panchang calculation.',
    );
  }

  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('Invalid UTC date for Panchang calculation.');
  }

  const sun = normalizeDegrees(sunSiderealLongitude);
  const moon = normalizeDegrees(moonSiderealLongitude);

  const elongation = normalizeDegrees(moon - sun);

  // One Tithi = 12 degrees of Moon-Sun elongation.
  const tithiIndex = Math.floor(elongation / 12);
  const tithiNumber = tithiIndex + 1;

  const paksha =
    tithiNumber <= 15 ? 'Shukla' : 'Krishna';

  const nakshatraSpan = 360 / 27;
  const nakshatraIndex =
    Math.floor(moon / nakshatraSpan);

  const nakshatraPada =
    Math.floor(
      (moon - nakshatraIndex * nakshatraSpan) /
        (nakshatraSpan / 4),
    ) + 1;

  // Nitya Yoga uses the sum of sidereal Sun + Moon longitude.
  const yogaIndex =
    Math.floor(
      normalizeDegrees(sun + moon) / nakshatraSpan,
    );

  // One Karana = half a Tithi = 6 degrees.
  const halfTithiIndex =
    Math.floor(elongation / 6);

  return {
    day: {
      name: utcDate.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'UTC',
      }),
    },

    tithi: {
      name: TITHIS[tithiIndex],
      number: tithiNumber,
      type: paksha,
    },

    nakshatra: {
      name: NAKSHATRAS[nakshatraIndex],
      number: nakshatraIndex + 1,
      pada: nakshatraPada,
    },

    karana: {
      name: calculateKarana(halfTithiIndex),
      number: halfTithiIndex + 1,
    },

    yoga: {
      name: YOGAS[yogaIndex],
      number: yogaIndex + 1,
    },
  };
}
