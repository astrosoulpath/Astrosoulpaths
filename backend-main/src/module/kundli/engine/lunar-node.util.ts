import {
  tropicalToLahiriSidereal,
} from './lahiri-ayanamsha.util';

export type LunarNodePositions = {
  rahu: number;
  ketu: number;
};

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Mean lunar ascending node.
 *
 * Deterministic astronomical calculation.
 * No customer-specific or parity correction is hardcoded.
 */
export function calculateLunarNodes(
  utcDate: Date,
): LunarNodePositions {
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error(
      'Invalid UTC date for lunar-node calculation.',
    );
  }

  const jd =
    utcDate.getTime() / 86400000 + 2440587.5;

  const t =
    (jd - 2451545.0) / 36525;

  const meanNodeTropical =
    125.04455501 -
    1934.1361849 * t +
    0.0020762 * t * t +
    (t * t * t) / 467410 -
    (t * t * t * t) / 60616000;

  const rahu = tropicalToLahiriSidereal(
    normalizeDegrees(meanNodeTropical),
    utcDate,
  );

  const ketu = normalizeDegrees(
    rahu + 180,
  );

  return {
    rahu: normalizeDegrees(rahu),
    ketu,
  };
}
