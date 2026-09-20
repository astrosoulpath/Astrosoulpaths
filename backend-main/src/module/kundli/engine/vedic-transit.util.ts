import * as Astronomy from 'astronomy-engine';

import { calculatePlanetPositions } from './planetary-position.util';
import { calculateLunarNodes } from './lunar-node.util';
import { mapSiderealLongitude } from './vedic-position.util';
import { isPlanetRetrograde } from './retrograde.util';

export type LocalTransitPlanet = {
  name: string;
  longitude: number;
  sign: string;
  sign_no: number;
  degree: number;
  nakshatra: string;
  pada: number;
  retrograde: boolean;
};

export type LocalVedicTransit = {
  calculatedAt: string;
  zodiac: 'sidereal';
  ayanamsha: 'lahiri';
  planets: LocalTransitPlanet[];
  calculation: 'local-astronomy-engine-lahiri-transit';
};

const bodyMap: Record<string, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

export function calculateVedicTransit(
  transitDate: Date = new Date(),
): LocalVedicTransit {
  if (Number.isNaN(transitDate.getTime())) {
    throw new Error('Invalid transit date.');
  }

  const calculated = calculatePlanetPositions(transitDate);

  const planets: LocalTransitPlanet[] = calculated.map((planet) => {
    const vedic = mapSiderealLongitude(planet.siderealLongitude);
    const body = bodyMap[planet.name];

    if (!body) {
      throw new Error(`Unsupported transit planet: ${planet.name}`);
    }

    return {
      name: planet.name,
      longitude: planet.siderealLongitude,
      sign: vedic.sign,
      sign_no: vedic.sign_no,
      degree: vedic.degree,
      nakshatra: vedic.nakshatra,
      pada: vedic.nakshatra_pada,
      retrograde: isPlanetRetrograde(body, transitDate),
    };
  });

  const nodes = calculateLunarNodes(transitDate);

  for (const node of [
    { name: 'Rahu', longitude: nodes.rahu },
    { name: 'Ketu', longitude: nodes.ketu },
  ]) {
    const vedic = mapSiderealLongitude(node.longitude);

    planets.push({
      name: node.name,
      longitude: node.longitude,
      sign: vedic.sign,
      sign_no: vedic.sign_no,
      degree: vedic.degree,
      nakshatra: vedic.nakshatra,
      pada: vedic.nakshatra_pada,
      retrograde: true,
    });
  }

  return {
    calculatedAt: transitDate.toISOString(),
    zodiac: 'sidereal',
    ayanamsha: 'lahiri',
    planets,
    calculation: 'local-astronomy-engine-lahiri-transit',
  };
}

