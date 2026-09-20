import * as Astronomy from 'astronomy-engine';

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function tropicalLongitude(
  body: Astronomy.Body,
  date: Date,
): number {
  const vector = Astronomy.GeoVector(body, date, false);
  const ecliptic = Astronomy.Ecliptic(vector);

  if (!Number.isFinite(ecliptic.elon)) {
    throw new Error(
      `Unable to calculate longitude for ${body}`,
    );
  }

  return normalizeDegrees(ecliptic.elon);
}

function signedAngularDifference(
  later: number,
  earlier: number,
): number {
  return ((later - earlier + 540) % 360) - 180;
}

export function isPlanetRetrograde(
  body: Astronomy.Body,
  utcDate: Date,
): boolean {
  if (Number.isNaN(utcDate.getTime())) {
    throw new Error(
      'Invalid UTC date for retrograde calculation.',
    );
  }

  // Sun and Moon are not marked retrograde in the
  // geocentric Vedic chart representation.
  if (
    body === Astronomy.Body.Sun ||
    body === Astronomy.Body.Moon
  ) {
    return false;
  }

  const halfHourMs = 30 * 60 * 1000;

  const before = new Date(
    utcDate.getTime() - halfHourMs,
  );

  const after = new Date(
    utcDate.getTime() + halfHourMs,
  );

  const beforeLongitude =
    tropicalLongitude(body, before);

  const afterLongitude =
    tropicalLongitude(body, after);

  return (
    signedAngularDifference(
      afterLongitude,
      beforeLongitude,
    ) < 0
  );
}
