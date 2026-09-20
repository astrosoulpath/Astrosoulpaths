function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Returns Vedic whole-sign house number (1..12).
 *
 * Example:
 * Ascendant in Pisces:
 * Pisces = house 1
 * Aries = house 2
 * ...
 * Sagittarius = house 10
 */
export function calculateWholeSignHouse(
  siderealLongitude: number,
  siderealAscendant: number,
): number {
  if (
    !Number.isFinite(siderealLongitude) ||
    !Number.isFinite(siderealAscendant)
  ) {
    throw new Error(
      'Longitude and Ascendant must be finite numbers.',
    );
  }

  const planetSign = Math.floor(
    normalizeDegrees(siderealLongitude) / 30,
  );

  const ascendantSign = Math.floor(
    normalizeDegrees(siderealAscendant) / 30,
  );

  return (
    ((planetSign - ascendantSign + 12) % 12) + 1
  );
}
