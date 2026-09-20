import * as Astronomy from 'astronomy-engine';
import {
  calculateLahiriAyanamsha,
  tropicalToLahiriSidereal,
} from './lahiri-ayanamsha.util';

export type LocalPlanetPosition = {
  name: string;
  tropicalLongitude: number;
  tropicalLatitude: number;
  siderealLongitude: number;
};

const PLANETS = [
  Astronomy.Body.Sun,
  Astronomy.Body.Moon,
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
] as const;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function calculatePlanetPositions(
  utcDate: Date,
): LocalPlanetPosition[] {
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error('Invalid UTC date for planetary calculation');
  }

  // Calculated dynamically for this exact date.
  const ayanamsha = calculateLahiriAyanamsha(utcDate);

  if (!Number.isFinite(ayanamsha)) {
    throw new Error('Unable to calculate Lahiri ayanamsha');
  }

  return PLANETS.map((body) => {
    // aberration=false chosen from our parity tests.
    const vector = Astronomy.GeoVector(body, utcDate, false);
    const ecliptic = Astronomy.Ecliptic(vector);

    if (
      !Number.isFinite(ecliptic.elon) ||
      !Number.isFinite(ecliptic.elat)
    ) {
      throw new Error(`Astronomical calculation failed for ${body}`);
    }

    const tropicalLongitude = normalizeDegrees(ecliptic.elon);

    return {
      name: String(body),
      tropicalLongitude,
      tropicalLatitude: ecliptic.elat,
      siderealLongitude: tropicalToLahiriSidereal(
        tropicalLongitude,
        utcDate,
      ),
    };
  });
}
