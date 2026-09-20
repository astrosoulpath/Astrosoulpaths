import * as Astronomy from 'astronomy-engine';

/**
 * Lahiri / Chitrapaksha ayanamsha.
 *
 * Reference epoch:
 * 1956-03-21 00:00 UTC
 * Lahiri ayanamsha = 23°15'00.658"
 *
 * The value is advanced/reversed dynamically using Astronomy Engine's
 * date-dependent precession/ecliptic rotation.
 *
 * No per-user hardcoded ayanamsha is used.
 */

const LAHIRI_REFERENCE_DATE = new Date('1956-03-21T00:00:00.000Z');

const LAHIRI_REFERENCE_DEGREES =
  23 +
  15 / 60 +
  0.658 / 3600;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function signedAngle(value: number): number {
  const n = normalizeDegrees(value);
  return n > 180 ? n - 360 : n;
}

/**
 * Measures the date-dependent displacement of the J2000
 * equinox in Astronomy Engine's true ecliptic-of-date frame.
 */
function precessionLongitude(date: Date): number {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date for Lahiri ayanamsha calculation');
  }

  const time = Astronomy.MakeTime(date);

  const vector = new Astronomy.Vector(
    1,
    0,
    0,
    time,
  );

  const rotation = Astronomy.Rotation_EQJ_ECT(time);
  const rotated = Astronomy.RotateVector(rotation, vector);

  return normalizeDegrees(
    Math.atan2(rotated.y, rotated.x) * 180 / Math.PI,
  );
}

const REFERENCE_PRECESSION =
  precessionLongitude(LAHIRI_REFERENCE_DATE);

export function calculateLahiriAyanamsha(date: Date): number {
  const current = precessionLongitude(date);

  const movement = signedAngle(
    current - REFERENCE_PRECESSION,
  );

  return normalizeDegrees(
    LAHIRI_REFERENCE_DEGREES + movement,
  );
}

export function tropicalToLahiriSidereal(
  tropicalLongitude: number,
  date: Date,
): number {
  if (!Number.isFinite(tropicalLongitude)) {
    throw new Error('Invalid tropical longitude');
  }

  return normalizeDegrees(
    tropicalLongitude - calculateLahiriAyanamsha(date),
  );
}
