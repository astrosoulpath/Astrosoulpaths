import * as Astronomy from 'astronomy-engine';
import {
  calculateLahiriAyanamsha,
  tropicalToLahiriSidereal,
} from './lahiri-ayanamsha.util';

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function calculateSiderealAscendant(
  utcDate: Date,
  latitude: number,
  longitude: number,
): number {
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('Invalid UTC date for Ascendant calculation.');
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  const gstHours = Astronomy.SiderealTime(utcDate);

  const localSiderealDegrees = normalizeDegrees(
    gstHours * 15 + longitude,
  );

  const tilt = Astronomy.e_tilt(
    Astronomy.MakeTime(utcDate),
  );

  const theta = toRadians(localSiderealDegrees);
  const phi = toRadians(latitude);
  const epsilon = toRadians(tilt.tobl);

  const y = -Math.cos(theta);

  const x =
    Math.sin(theta) * Math.cos(epsilon) +
    Math.tan(phi) * Math.sin(epsilon);

  // atan2 gives the opposite horizon intersection for this orientation.
  // +180 selects the eastern ecliptic/horizon intersection = Ascendant.
  const tropicalAscendant = normalizeDegrees(
    toDegrees(Math.atan2(y, x)) + 180,
  );

  return tropicalToLahiriSidereal(
    tropicalAscendant,
    utcDate,
  );
}

