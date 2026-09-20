export type AshtakootKootaName =
  | 'Varna'
  | 'Vashya'
  | 'Tara'
  | 'Yoni'
  | 'GrahaMaitri'
  | 'Gana'
  | 'Bhakoot'
  | 'Nadi';

export type AshtakootPerson = {
  moonLongitude: number;
  rashiNumber: number;
  nakshatraNumber: number;
  nakshatraPada: number;
};

export type AshtakootKootaResult = {
  name: AshtakootKootaName;
  score: number;
  maximum: number;
};

export type LocalAshtakootResult = {
  source: 'local-vedic';
  system: 'Ashtakoot';
  maximumScore: 36;
  totalScore: number;
  boy: AshtakootPerson;
  girl: AshtakootPerson;
  kootas: AshtakootKootaResult[];
};

/*
 * Production rule:
 *
 * Do NOT generate random/default compatibility scores.
 * Every koota score must be produced from a separately verified
 * deterministic Ashtakoot rule.
 *
 * Maximum traditional weighting:
 * Varna 1
 * Vashya 2
 * Tara 3
 * Yoni 4
 * Graha Maitri 5
 * Gana 6
 * Bhakoot 7
 * Nadi 8
 *
 * Total = 36.
 *
 * Calculation implementation will be added only after the rule
 * tables used by this engine are explicitly verified.
 */

type VarnaRank = 1 | 2 | 3 | 4;

function getVarnaRank(rashiNumber: number): VarnaRank {
  if (![1,2,3,4,5,6,7,8,9,10,11,12].includes(rashiNumber)) {
    throw new Error(`Invalid Rashi number for Varna: ${rashiNumber}`);
  }

  // 4 = Brahmin, 3 = Kshatriya, 2 = Vaishya, 1 = Shudra
  if ([4, 8, 12].includes(rashiNumber)) return 4;
  if ([1, 5, 9].includes(rashiNumber)) return 3;
  if ([2, 6, 10].includes(rashiNumber)) return 2;

  return 1;
}

export function calculateVarnaKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyVarna = getVarnaRank(boy.rashiNumber);
  const girlVarna = getVarnaRank(girl.rashiNumber);

  return {
    name: 'Varna',
    score: boyVarna >= girlVarna ? 1 : 0,
    maximum: 1,
  };
}

export type VashyaCategory =
  | 'Biped'
  | 'Quadruped'
  | 'Jalchar'
  | 'Vanchar'
  | 'Keet';

export function getVashyaCategory(
  person: AshtakootPerson,
): VashyaCategory {
  const rashi = person.rashiNumber;

  if (rashi < 1 || rashi > 12) {
    throw new Error(`Invalid Rashi number for Vashya: ${rashi}`);
  }

  const degreeInSign =
    ((person.moonLongitude % 30) + 30) % 30;

  // Gemini, Virgo, Libra, first half Sagittarius, Aquarius
  if (
    [3, 6, 7, 11].includes(rashi) ||
    (rashi === 9 && degreeInSign < 15)
  ) {
    return 'Biped';
  }

  // Aries, Taurus, second half Sagittarius, first half Capricorn
  if (
    [1, 2].includes(rashi) ||
    (rashi === 9 && degreeInSign >= 15) ||
    (rashi === 10 && degreeInSign < 15)
  ) {
    return 'Quadruped';
  }

  // Cancer, second half Capricorn, Pisces
  if (
    [4, 12].includes(rashi) ||
    (rashi === 10 && degreeInSign >= 15)
  ) {
    return 'Jalchar';
  }

  if (rashi === 5) {
    return 'Vanchar';
  }

  if (rashi === 8) {
    return 'Keet';
  }

  throw new Error(
    `Unable to classify Vashya for Rashi ${rashi}`,
  );
}

const VASHYA_SCORE_MATRIX: Record<
  VashyaCategory,
  Record<VashyaCategory, number>
> = {
  Biped: {
    Biped: 2,
    Quadruped: 1,
    Jalchar: 1,
    Vanchar: 0,
    Keet: 1,
  },
  Quadruped: {
    Biped: 1,
    Quadruped: 2,
    Jalchar: 1,
    Vanchar: 0.5,
    Keet: 1,
  },
  Jalchar: {
    Biped: 1,
    Quadruped: 1,
    Jalchar: 2,
    Vanchar: 1,
    Keet: 1,
  },
  Vanchar: {
    Biped: 0,
    Quadruped: 0.5,
    Jalchar: 1,
    Vanchar: 2,
    Keet: 0,
  },
  Keet: {
    Biped: 1,
    Quadruped: 1,
    Jalchar: 1,
    Vanchar: 0,
    Keet: 2,
  },
};

export function calculateVashyaKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyVashya = getVashyaCategory(boy);
  const girlVashya = getVashyaCategory(girl);

  const score = VASHYA_SCORE_MATRIX[boyVashya][girlVashya];

  return {
    name: 'Vashya',
    score,
    maximum: 2,
  };
}

function taraRemainder(
  fromNakshatra: number,
  toNakshatra: number,
): number {
  if (
    fromNakshatra < 1 || fromNakshatra > 27 ||
    toNakshatra < 1 || toNakshatra > 27
  ) {
    throw new Error(
      `Invalid Nakshatra numbers for Tara: ${fromNakshatra}, ${toNakshatra}`,
    );
  }

  const inclusiveDistance =
    ((toNakshatra - fromNakshatra + 27) % 27) + 1;

  const remainder = inclusiveDistance % 9;

  return remainder === 0 ? 9 : remainder;
}

function taraDirectionScore(
  fromNakshatra: number,
  toNakshatra: number,
): number {
  const tara = taraRemainder(fromNakshatra, toNakshatra);

  // 3 = Vipat, 5 = Pratyari, 7 = Vadha
  return [3, 5, 7].includes(tara) ? 0 : 1.5;
}

export function calculateTaraKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyToGirl = taraDirectionScore(
    boy.nakshatraNumber,
    girl.nakshatraNumber,
  );

  const girlToBoy = taraDirectionScore(
    girl.nakshatraNumber,
    boy.nakshatraNumber,
  );

  return {
    name: 'Tara',
    score: boyToGirl + girlToBoy,
    maximum: 3,
  };
}

export type YoniAnimal =
  | 'Horse'
  | 'Elephant'
  | 'Sheep'
  | 'Serpent'
  | 'Dog'
  | 'Cat'
  | 'Rat'
  | 'Cow'
  | 'Buffalo'
  | 'Tiger'
  | 'Deer'
  | 'Monkey'
  | 'Mongoose'
  | 'Lion';

const NAKSHATRA_YONI: readonly YoniAnimal[] = [
  'Horse',     // 1 Ashwini
  'Elephant',  // 2 Bharani
  'Sheep',     // 3 Krittika
  'Serpent',   // 4 Rohini
  'Serpent',   // 5 Mrigashira
  'Dog',       // 6 Ardra
  'Cat',       // 7 Punarvasu
  'Sheep',     // 8 Pushya
  'Cat',       // 9 Ashlesha
  'Rat',       // 10 Magha
  'Rat',       // 11 Purva Phalguni
  'Cow',       // 12 Uttara Phalguni
  'Buffalo',   // 13 Hasta
  'Tiger',     // 14 Chitra
  'Buffalo',   // 15 Swati
  'Tiger',     // 16 Vishakha
  'Deer',      // 17 Anuradha
  'Deer',      // 18 Jyeshtha
  'Dog',       // 19 Mula
  'Monkey',    // 20 Purva Ashadha
  'Mongoose',  // 21 Uttara Ashadha
  'Monkey',    // 22 Shravana
  'Lion',      // 23 Dhanishta
  'Horse',     // 24 Shatabhisha
  'Lion',      // 25 Purva Bhadrapada
  'Cow',       // 26 Uttara Bhadrapada
  'Elephant',  // 27 Revati
];

export function getYoniAnimal(
  nakshatraNumber: number,
): YoniAnimal {
  if (
    !Number.isInteger(nakshatraNumber) ||
    nakshatraNumber < 1 ||
    nakshatraNumber > 27
  ) {
    throw new Error(
      `Invalid Nakshatra number for Yoni: ${nakshatraNumber}`,
    );
  }

  return NAKSHATRA_YONI[nakshatraNumber - 1];
}

const YONI_HOSTILE_PAIRS = new Set<string>([
  'Buffalo|Horse',
  'Elephant|Lion',
  'Monkey|Sheep',
  'Mongoose|Serpent',
  'Deer|Dog',
  'Cat|Rat',
  'Cow|Tiger',
]);

function yoniPairKey(a: YoniAnimal, b: YoniAnimal): string {
  return [a, b].sort().join('|');
}

export function areHostileYonis(
  a: YoniAnimal,
  b: YoniAnimal,
): boolean {
  return YONI_HOSTILE_PAIRS.has(yoniPairKey(a, b));
}

export type ClassicalPlanet =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn';

const RASHI_LORDS: Record<number, ClassicalPlanet> = {
  1: 'Mars',     // Aries
  2: 'Venus',    // Taurus
  3: 'Mercury',  // Gemini
  4: 'Moon',     // Cancer
  5: 'Sun',      // Leo
  6: 'Mercury',  // Virgo
  7: 'Venus',    // Libra
  8: 'Mars',     // Scorpio
  9: 'Jupiter',  // Sagittarius
  10: 'Saturn',  // Capricorn
  11: 'Saturn',  // Aquarius
  12: 'Jupiter', // Pisces
};

export function getRashiLord(
  rashiNumber: number,
): ClassicalPlanet {
  if (
    !Number.isInteger(rashiNumber) ||
    rashiNumber < 1 ||
    rashiNumber > 12
  ) {
    throw new Error(
      `Invalid Rashi number for Graha Maitri: ${rashiNumber}`,
    );
  }

  return RASHI_LORDS[rashiNumber];
}

export type PlanetRelation = 'Friend' | 'Neutral' | 'Enemy';

const NATURAL_PLANET_RELATIONS: Record<
  ClassicalPlanet,
  {
    friends: readonly ClassicalPlanet[];
    neutrals: readonly ClassicalPlanet[];
    enemies: readonly ClassicalPlanet[];
  }
> = {
  Sun: {
    friends: ['Moon', 'Mars', 'Jupiter'],
    neutrals: ['Mercury'],
    enemies: ['Venus', 'Saturn'],
  },

  Moon: {
    friends: ['Sun', 'Mercury'],
    neutrals: ['Mars', 'Jupiter', 'Venus', 'Saturn'],
    enemies: [],
  },

  Mars: {
    friends: ['Sun', 'Moon', 'Jupiter'],
    neutrals: ['Venus', 'Saturn'],
    enemies: ['Mercury'],
  },

  Mercury: {
    friends: ['Sun', 'Venus'],
    neutrals: ['Mars', 'Jupiter', 'Saturn'],
    enemies: ['Moon'],
  },

  Jupiter: {
    friends: ['Sun', 'Moon', 'Mars'],
    neutrals: ['Saturn'],
    enemies: ['Mercury', 'Venus'],
  },

  Venus: {
    friends: ['Mercury', 'Saturn'],
    neutrals: ['Mars', 'Jupiter'],
    enemies: ['Sun', 'Moon'],
  },

  Saturn: {
    friends: ['Mercury', 'Venus'],
    neutrals: ['Jupiter'],
    enemies: ['Sun', 'Moon', 'Mars'],
  },
};

export function getNaturalPlanetRelation(
  from: ClassicalPlanet,
  to: ClassicalPlanet,
): PlanetRelation {
  if (from === to) {
    return 'Friend';
  }

  const relations = NATURAL_PLANET_RELATIONS[from];

  if (relations.friends.includes(to)) {
    return 'Friend';
  }

  if (relations.enemies.includes(to)) {
    return 'Enemy';
  }

  return 'Neutral';
}

function grahaMaitriScore(
  a: PlanetRelation,
  b: PlanetRelation,
): number {
  if (a === 'Friend' && b === 'Friend') return 5;

  if (
    (a === 'Friend' && b === 'Neutral') ||
    (a === 'Neutral' && b === 'Friend')
  ) {
    return 4;
  }

  if (a === 'Neutral' && b === 'Neutral') return 3;

  if (
    (a === 'Friend' && b === 'Enemy') ||
    (a === 'Enemy' && b === 'Friend')
  ) {
    return 1;
  }

  if (
    (a === 'Neutral' && b === 'Enemy') ||
    (a === 'Enemy' && b === 'Neutral')
  ) {
    return 0.5;
  }

  return 0;
}

export function calculateGrahaMaitriKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyLord = getRashiLord(boy.rashiNumber);
  const girlLord = getRashiLord(girl.rashiNumber);

  // Same Moon-sign lord = full Maitri.
  if (boyLord === girlLord) {
    return {
      name: 'GrahaMaitri',
      score: 5,
      maximum: 5,
    };
  }

  const boyToGirl = getNaturalPlanetRelation(
    boyLord,
    girlLord,
  );

  const girlToBoy = getNaturalPlanetRelation(
    girlLord,
    boyLord,
  );

  return {
    name: 'GrahaMaitri',
    score: grahaMaitriScore(boyToGirl, girlToBoy),
    maximum: 5,
  };
}

export type GanaType = 'Deva' | 'Manushya' | 'Rakshasa';

const NAKSHATRA_GANA: readonly GanaType[] = [
  'Deva',      // 1 Ashwini
  'Manushya',  // 2 Bharani
  'Rakshasa',  // 3 Krittika
  'Manushya',  // 4 Rohini
  'Deva',      // 5 Mrigashira
  'Manushya',  // 6 Ardra
  'Deva',      // 7 Punarvasu
  'Deva',      // 8 Pushya
  'Rakshasa',  // 9 Ashlesha
  'Rakshasa',  // 10 Magha
  'Manushya',  // 11 Purva Phalguni
  'Manushya',  // 12 Uttara Phalguni
  'Deva',      // 13 Hasta
  'Rakshasa',  // 14 Chitra
  'Deva',      // 15 Swati
  'Rakshasa',  // 16 Vishakha
  'Deva',      // 17 Anuradha
  'Rakshasa',  // 18 Jyeshtha
  'Rakshasa',  // 19 Mula
  'Manushya',  // 20 Purva Ashadha
  'Manushya',  // 21 Uttara Ashadha
  'Deva',      // 22 Shravana
  'Rakshasa',  // 23 Dhanishta
  'Rakshasa',  // 24 Shatabhisha
  'Manushya',  // 25 Purva Bhadrapada
  'Manushya',  // 26 Uttara Bhadrapada
  'Deva',      // 27 Revati
];

export function getGana(
  nakshatraNumber: number,
): GanaType {
  if (
    !Number.isInteger(nakshatraNumber) ||
    nakshatraNumber < 1 ||
    nakshatraNumber > 27
  ) {
    throw new Error(
      `Invalid Nakshatra number for Gana: ${nakshatraNumber}`,
    );
  }

  return NAKSHATRA_GANA[nakshatraNumber - 1];
}

export function calculateGanaKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyGana = getGana(boy.nakshatraNumber);
  const girlGana = getGana(girl.nakshatraNumber);

  let score = 0;

  if (boyGana === girlGana) {
    score = 6;
  }

  if (
    boyGana !== girlGana &&
    [boyGana, girlGana].includes('Deva') &&
    [boyGana, girlGana].includes('Manushya')
  ) {
    score = 5;
  }

  if (
    boyGana !== girlGana &&
    [boyGana, girlGana].includes('Deva') &&
    [boyGana, girlGana].includes('Rakshasa')
  ) {
    score = 1;
  }

  return {
    name: 'Gana',
    score,
    maximum: 6,
  };
}

function inclusiveRashiDistance(
  fromRashi: number,
  toRashi: number,
): number {
  if (
    !Number.isInteger(fromRashi) ||
    !Number.isInteger(toRashi) ||
    fromRashi < 1 ||
    fromRashi > 12 ||
    toRashi < 1 ||
    toRashi > 12
  ) {
    throw new Error(
      `Invalid Rashi numbers for Bhakoot: ${fromRashi}, ${toRashi}`,
    );
  }

  return ((toRashi - fromRashi + 12) % 12) + 1;
}

export function calculateBhakootKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyToGirl = inclusiveRashiDistance(
    boy.rashiNumber,
    girl.rashiNumber,
  );

  const girlToBoy = inclusiveRashiDistance(
    girl.rashiNumber,
    boy.rashiNumber,
  );

  const pair = [boyToGirl, girlToBoy]
    .sort((a, b) => a - b)
    .join('/');

  const doshaPairs = new Set([
    '2/12',
    '5/9',
    '6/8',
  ]);

  return {
    name: 'Bhakoot',
    score: doshaPairs.has(pair) ? 0 : 7,
    maximum: 7,
  };
}

export type NadiType = 'Adi' | 'Madhya' | 'Antya';

export function getNadi(
  nakshatraNumber: number,
): NadiType {
  if (
    !Number.isInteger(nakshatraNumber) ||
    nakshatraNumber < 1 ||
    nakshatraNumber > 27
  ) {
    throw new Error(
      `Invalid Nakshatra number for Nadi: ${nakshatraNumber}`,
    );
  }

  const position = (nakshatraNumber - 1) % 3;

  if (position === 0) return 'Adi';
  if (position === 1) return 'Madhya';

  return 'Antya';
}

export function calculateNadiKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyNadi = getNadi(boy.nakshatraNumber);
  const girlNadi = getNadi(girl.nakshatraNumber);

  return {
    name: 'Nadi',
    score: boyNadi === girlNadi ? 0 : 8,
    maximum: 8,
  };
}

export function calculateYoniKoota(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): AshtakootKootaResult {
  const boyYoni = getYoniAnimal(boy.nakshatraNumber);
  const girlYoni = getYoniAnimal(girl.nakshatraNumber);

  if (boyYoni === girlYoni) {
    return {
      name: 'Yoni',
      score: 4,
      maximum: 4,
    };
  }

  if (areHostileYonis(boyYoni, girlYoni)) {
    return {
      name: 'Yoni',
      score: 0,
      maximum: 4,
    };
  }

  throw new Error(
    `Yoni compatibility matrix not verified for ${boyYoni} and ${girlYoni}`,
  );
}

export function calculateAshtakootMatch(
  boy: AshtakootPerson,
  girl: AshtakootPerson,
): LocalAshtakootResult {
  const kootas: AshtakootKootaResult[] = [
    calculateVarnaKoota(boy, girl),
    calculateVashyaKoota(boy, girl),
    calculateTaraKoota(boy, girl),
    calculateYoniKoota(boy, girl),
    calculateGrahaMaitriKoota(boy, girl),
    calculateGanaKoota(boy, girl),
    calculateBhakootKoota(boy, girl),
    calculateNadiKoota(boy, girl),
  ];

  const totalScore = kootas.reduce(
    (sum, koota) => sum + koota.score,
    0,
  );

  const maximumScore = kootas.reduce(
    (sum, koota) => sum + koota.maximum,
    0,
  );

  if (maximumScore !== 36) {
    throw new Error(
      `Invalid Ashtakoot maximum score: ${maximumScore}`,
    );
  }

  if (totalScore < 0 || totalScore > 36) {
    throw new Error(
      `Invalid Ashtakoot total score: ${totalScore}`,
    );
  }

  return {
    source: 'local-vedic',
    system: 'Ashtakoot',
    maximumScore: 36,
    totalScore,
    boy,
    girl,
    kootas,
  };
}
