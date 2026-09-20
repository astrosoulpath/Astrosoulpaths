import { calculatePlanetPositions } from './planetary-position.util';

export type LocalSadeSatiResult = {
  is_in_sade_sati: boolean;
  transit_phase: 'rising' | 'peak' | 'setting' | 'not_active';
  description: string;
  natal_moon_sign_index: number;
  transit_saturn_sign_index: number;
  transit_saturn_sidereal_longitude: number;
  calculated_at: string;
  calculation: 'lahiri-sidereal-moon-saturn-sign-rule';
};

function signIndex(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new Error('Invalid sidereal longitude for Sade Sati calculation');
  }

  const normalized = ((longitude % 360) + 360) % 360;
  return Math.floor(normalized / 30);
}

export function calculateSadeSati(
  natalMoonSiderealLongitude: number,
  transitDate: Date = new Date(),
): LocalSadeSatiResult {
  if (!Number.isFinite(natalMoonSiderealLongitude)) {
    throw new Error('Natal Moon longitude unavailable for Sade Sati calculation');
  }

  if (Number.isNaN(transitDate.getTime())) {
    throw new Error('Invalid transit date for Sade Sati calculation');
  }

  const transitPlanets = calculatePlanetPositions(transitDate);

  const saturn = transitPlanets.find(
    (planet) => planet.name.toLowerCase() === 'saturn',
  );

  if (!saturn) {
    throw new Error('Transit Saturn unavailable for Sade Sati calculation');
  }

  const moonSign = signIndex(natalMoonSiderealLongitude);
  const saturnSign = signIndex(saturn.siderealLongitude);

  const previousMoonSign = (moonSign + 11) % 12;
  const nextMoonSign = (moonSign + 1) % 12;

  let phase: LocalSadeSatiResult['transit_phase'] = 'not_active';

  if (saturnSign === previousMoonSign) {
    phase = 'rising';
  }

  if (saturnSign === moonSign) {
    phase = 'peak';
  }

  if (saturnSign === nextMoonSign) {
    phase = 'setting';
  }

  const active = phase !== 'not_active';

  const descriptions: Record<
    LocalSadeSatiResult['transit_phase'],
    string
  > = {
    rising:
      'Saturn is transiting the sign immediately before the natal Moon sign.',
    peak:
      'Saturn is transiting the natal Moon sign.',
    setting:
      'Saturn is transiting the sign immediately after the natal Moon sign.',
    not_active:
      'Saturn is not transiting the natal Moon sign or its immediately adjacent Sade Sati signs.',
  };

  return {
    is_in_sade_sati: active,
    transit_phase: phase,
    description: descriptions[phase],
    natal_moon_sign_index: moonSign,
    transit_saturn_sign_index: saturnSign,
    transit_saturn_sidereal_longitude: saturn.siderealLongitude,
    calculated_at: transitDate.toISOString(),
    calculation: 'lahiri-sidereal-moon-saturn-sign-rule',
  };
}
