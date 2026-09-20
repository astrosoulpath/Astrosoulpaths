export type LocalMangalDoshaResult = {
  present: boolean;
  isManglik: boolean;
  marsHouse: number;
  reference: 'Lagna';
  doshaHouses: number[];
  severity: 'none' | 'present';
  cancellationApplied: false;
  calculation: 'vedic-lagna-house-rule';
};

/**
 * Basic Vedic Kuja / Mangal Dosha calculation from Lagna.
 *
 * Mars in houses 1, 2, 4, 7, 8 or 12 is flagged.
 *
 * Cancellation / exception rules are deliberately NOT inferred here.
 * They must be added only after separately verified rules are implemented.
 */
export function calculateMangalDosha(
  marsHouse: number,
): LocalMangalDoshaResult {
  if (
    !Number.isInteger(marsHouse) ||
    marsHouse < 1 ||
    marsHouse > 12
  ) {
    throw new Error(
      `Invalid Mars house for Mangal Dosha: ${marsHouse}`,
    );
  }

  const doshaHouses = [1, 2, 4, 7, 8, 12];

  const present = doshaHouses.includes(marsHouse);

  return {
    present,
    isManglik: present,
    marsHouse,
    reference: 'Lagna',
    doshaHouses,
    severity: present ? 'present' : 'none',
    cancellationApplied: false,
    calculation: 'vedic-lagna-house-rule',
  };
}
