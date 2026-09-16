export type ProfessionalKundliValidation = {
  valid: boolean;
  missingSections: string[];
  advancedMissingSections: string[];
  corePercent: number | null;
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }

  return true;
}

/*
 * Some valid astrology sections can legitimately be empty.
 * Example: no applicable Yoga/Dosha.
 *
 * Therefore:
 * null / undefined = unavailable
 * empty valid provider result = accepted
 */
function hasProviderSection(value: unknown): boolean {
  return value !== null && value !== undefined;
}

export function validateProfessionalKundliReport(
  input: unknown,
): ProfessionalKundliValidation {
  const missingSections: string[] = [];
  const advancedMissingSections: string[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      missingSections: ['report'],
      advancedMissingSections: [],
      corePercent: null,
    };
  }

  const report = input;

  // ----------------------------------------------------------
  // Provider identity/status
  // ----------------------------------------------------------

  const supportedProviders = new Set(['prokerala', 'vedicastro']);

  if (
    typeof report.provider !== 'string' ||
    !supportedProviders.has(report.provider)
  ) {
    missingSections.push('provider');
  }

  if (report.status !== 'COMPLETE') {
    missingSections.push('status');
  }

  // ----------------------------------------------------------
  // Core completeness
  // ----------------------------------------------------------

  const completeness = isRecord(report.completeness)
    ? report.completeness
    : null;

  const rawCorePercent =
    completeness?.corePercent ?? completeness?.core ?? null;

  const parsedCorePercent =
    typeof rawCorePercent === 'number'
      ? rawCorePercent
      : Number(rawCorePercent);

  const corePercent = Number.isFinite(parsedCorePercent)
    ? parsedCorePercent
    : null;

  if (corePercent !== 100) {
    missingSections.push('completeness.corePercent');
  }

  // ----------------------------------------------------------
  // DOCUMENT PHASE-1 CORE
  //
  // Birth Chart D1
  // Navamsa D9
  // ----------------------------------------------------------

  if (!hasMeaningfulValue(report.birthChart)) {
    missingSections.push('birthChart.D1');
  }

  if (!hasMeaningfulValue(report.navamsaChart)) {
    missingSections.push('navamsaChart.D9');
  }

  // ----------------------------------------------------------
  // Planetary positions
  // ----------------------------------------------------------

  const planetaryPositions = Array.isArray(report.planetaryPositions)
    ? report.planetaryPositions
    : [];

  if (planetaryPositions.length < 9) {
    missingSections.push('planetaryPositions');
  }

  // ----------------------------------------------------------
  // Vimshottari / Dasha
  // ----------------------------------------------------------

  const dashaTimeline = Array.isArray(report.dasha?.timeline)
    ? report.dasha.timeline
    : [];

  if (dashaTimeline.length === 0) {
    missingSections.push('dasha.timeline');
  }

  // ----------------------------------------------------------
  // Panchang
  // ----------------------------------------------------------

  if (!hasMeaningfulValue(report.panchang)) {
    missingSections.push('panchang');
  }

  // ----------------------------------------------------------
  // Yoga / Dosha / Strength calculations
  // ----------------------------------------------------------

  if (!hasProviderSection(report.yogas)) {
    missingSections.push('yogas');
  }

  if (!hasProviderSection(report.dosha)) {
    missingSections.push('dosha');
  }

  /*
   * Shadbala is not currently available from a verified Prokerala
   * source in this integration. Keep it visible as unavailable,
   * but do not fail an otherwise valid Phase-1 Kundli.
   */
  if (!hasProviderSection(report.shadbala)) {
    advancedMissingSections.push('shadbala');
  }

  if (!hasProviderSection(report.ashtakavarga)) {
    missingSections.push('ashtakavarga');
  }

  // ----------------------------------------------------------
  // PHASE-2 ADVANCED VARGAS
  //
  // These are professional advanced sections.
  // They are tracked separately from Phase-1 D1/D9 validity.
  // ----------------------------------------------------------

  const charts = isRecord(report.charts) ? report.charts : null;

  const divisionalCharts = isRecord(charts?.divisionalCharts)
    ? charts.divisionalCharts
    : null;

  const advancedVargas = ['D2', 'D3', 'D7', 'D10', 'D12', 'D60'] as const;

  for (const division of advancedVargas) {
    if (!hasMeaningfulValue(divisionalCharts?.[division])) {
      advancedMissingSections.push(`charts.divisionalCharts.${division}`);
    }
  }

  return {
    valid: missingSections.length === 0,
    missingSections,
    advancedMissingSections,
    corePercent,
  };
}
