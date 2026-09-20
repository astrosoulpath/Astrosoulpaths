export interface KpHouse {
  house: number;
  longitude: number;
  sign: string;
  signNo: number;
  degreeInSign: number;
  starLord: string;
  subLord: string;
}

export interface KpPlanet {
  name: string;
  longitude: number;
  sign: string;
  signNo: number;
  degreeInSign: number;
  starLord: string;
  subLord: string;
  retrograde: boolean;
}

export interface KpCalculationResult {
  system: 'KP';
  houses: KpHouse[];
  planets: KpPlanet[];
}

export interface KpStarSubLord {
  starLord: string;
  subLord: string;
}

const VIMSHOTTARI_LORDS = [
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

const VIMSHOTTARI_YEARS: Record<
  (typeof VIMSHOTTARI_LORDS)[number],
  number
> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const NAKSHATRA_SPAN = 360 / 27;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function calculateKpStarSubLord(
  siderealLongitude: number,
): KpStarSubLord {
  if (!Number.isFinite(siderealLongitude)) {
    throw new Error(
      'KP longitude must be a finite number.',
    );
  }

  const longitude =
    normalizeDegrees(siderealLongitude);

  const nakshatraIndex =
    Math.floor(longitude / NAKSHATRA_SPAN);

  const starLordIndex =
    nakshatraIndex % VIMSHOTTARI_LORDS.length;

  const starLord =
    VIMSHOTTARI_LORDS[starLordIndex];

  const positionInsideNakshatra =
    longitude -
    nakshatraIndex * NAKSHATRA_SPAN;

  let consumed = 0;

  for (let offset = 0; offset < 9; offset++) {
    const lord =
      VIMSHOTTARI_LORDS[
        (starLordIndex + offset) %
          VIMSHOTTARI_LORDS.length
      ];

    const span =
      NAKSHATRA_SPAN *
      (VIMSHOTTARI_YEARS[lord] / 120);

    const upperBoundary = consumed + span;

    if (
      positionInsideNakshatra <
        upperBoundary ||
      offset === 8
    ) {
      return {
        starLord,
        subLord: lord,
      };
    }

    consumed = upperBoundary;
  }

  throw new Error(
    'Unable to calculate KP sub lord.',
  );
}

/*
 * KP house cusps are intentionally not calculated here yet.
 * Whole-sign D1 houses must never be substituted for KP cusps.
 */

import * as Astronomy from 'astronomy-engine';
import { tropicalToLahiriSidereal } from './lahiri-ayanamsha.util';

export interface KpHouseCuspsResult {
  system: 'KP-Placidus';
  tropicalCusps: number[];
  siderealCusps: number[];
  tropicalAscendant: number;
  tropicalMidheaven: number;
  siderealAscendant: number;
  siderealMidheaven: number;
}

function kpToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function kpToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function kpNormalize(value: number): number {
  return ((value % 360) + 360) % 360;
}

function solvePlacidusCusp(
  tanLatitude: number,
  ramcRadians: number,
  cosObliquity: number,
  sinObliquity: number,
  cuspRatio: number,
  nocturnal: boolean,
): number {
  const halfPi = Math.PI / 2;

  let ra =
    nocturnal
      ? ramcRadians +
        Math.PI -
        cuspRatio * halfPi
      : ramcRadians +
        cuspRatio * halfPi;

  for (let iteration = 0; iteration < 100; iteration++) {
    const longitude = Math.atan2(
      Math.sin(ra),
      Math.cos(ra) * cosObliquity,
    );

    const sinDeclination =
      Math.sin(longitude) * sinObliquity;

    const safeSinDeclination = Math.max(
      -0.999999999999,
      Math.min(0.999999999999, sinDeclination),
    );

    const declination =
      Math.asin(safeSinDeclination);

    const adArgument =
      tanLatitude * Math.tan(declination);

    if (Math.abs(adArgument) > 1) {
      throw new Error(
        'KP Placidus houses are unavailable at this latitude.',
      );
    }

    const ascensionalDifference =
      Math.asin(adArgument);

    const nextRa =
      nocturnal
        ? ramcRadians +
          Math.PI -
          cuspRatio *
            (halfPi - ascensionalDifference)
        : ramcRadians +
          cuspRatio *
            (halfPi + ascensionalDifference);

    const delta = Math.atan2(
      Math.sin(nextRa - ra),
      Math.cos(nextRa - ra),
    );

    ra = nextRa;

    if (Math.abs(delta) < 1e-12) {
      break;
    }
  }

  return kpNormalize(
    kpToDegrees(
      Math.atan2(
        Math.sin(ra),
        Math.cos(ra) * cosObliquity,
      ),
    ),
  );
}
export function calculateKpHouseCusps(
  utcDate: Date,
  latitude: number,
  longitude: number,
): KpHouseCuspsResult {
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('Invalid UTC date for KP calculation.');
  }

  if (
    !Number.isFinite(latitude) ||
    latitude <= -66.5 ||
    latitude >= 66.5
  ) {
    throw new Error(
      'KP Placidus houses currently require latitude between -66.5 and 66.5 degrees.',
    );
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid longitude for KP calculation.');
  }

  const siderealHours =
    Astronomy.SiderealTime(utcDate);

  const ramcDegrees = kpNormalize(
    siderealHours * 15 + longitude,
  );

  const ramc = kpToRadians(ramcDegrees);

  const tilt = Astronomy.e_tilt(
    Astronomy.MakeTime(utcDate),
  );

  const obliquity =
    kpToRadians(tilt.tobl);

  const cosObliquity =
    Math.cos(obliquity);

  const sinObliquity =
    Math.sin(obliquity);

  const tanLatitude =
    Math.tan(kpToRadians(latitude));

  const tropicalCusps =
    new Array<number>(12);

  tropicalCusps[10] = solvePlacidusCusp(
    tanLatitude,
    ramc,
    cosObliquity,
    sinObliquity,
    1 / 3,
    false,
  );

  tropicalCusps[11] = solvePlacidusCusp(
    tanLatitude,
    ramc,
    cosObliquity,
    sinObliquity,
    2 / 3,
    false,
  );

  tropicalCusps[1] = solvePlacidusCusp(
    tanLatitude,
    ramc,
    cosObliquity,
    sinObliquity,
    2 / 3,
    true,
  );

  tropicalCusps[2] = solvePlacidusCusp(
    tanLatitude,
    ramc,
    cosObliquity,
    sinObliquity,
    1 / 3,
    true,
  );

  const sinRamc = Math.sin(ramc);
  const cosRamc = Math.cos(ramc);

  const tropicalMc = kpNormalize(
    kpToDegrees(
      Math.atan2(
        sinRamc,
        cosRamc * cosObliquity,
      ),
    ),
  );

  const descendant = kpNormalize(
    kpToDegrees(
      Math.atan2(
        -cosRamc,
        sinRamc * cosObliquity +
          tanLatitude * sinObliquity,
      ),
    ),
  );

  const tropicalAscendant =
    kpNormalize(descendant + 180);

  tropicalCusps[0] = tropicalAscendant;
  tropicalCusps[9] = tropicalMc;
  tropicalCusps[3] = kpNormalize(tropicalMc + 180);
  tropicalCusps[6] = descendant;

  tropicalCusps[4] =
    kpNormalize(tropicalCusps[10] + 180);

  tropicalCusps[5] =
    kpNormalize(tropicalCusps[11] + 180);

  tropicalCusps[7] =
    kpNormalize(tropicalCusps[1] + 180);

  tropicalCusps[8] =
    kpNormalize(tropicalCusps[2] + 180);

  const siderealCusps =
    tropicalCusps.map((cusp) =>
      tropicalToLahiriSidereal(
        cusp,
        utcDate,
      ),
    );

  return {
    system: 'KP-Placidus',
    tropicalCusps,
    siderealCusps,
    tropicalAscendant,
    tropicalMidheaven: tropicalMc,
    siderealAscendant:
      tropicalToLahiriSidereal(
        tropicalAscendant,
        utcDate,
      ),
    siderealMidheaven:
      tropicalToLahiriSidereal(
        tropicalMc,
        utcDate,
      ),
  };
}

