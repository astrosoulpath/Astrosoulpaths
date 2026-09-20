export type VimshottariLord =
  | 'Ketu'
  | 'Venus'
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Rahu'
  | 'Jupiter'
  | 'Saturn'
  | 'Mercury';

export type VimshottariPeriod = {
  lord: VimshottariLord;
  level: 'Mahadasha';
  start: string;
  end: string;
  antardasha: {
    lord: VimshottariLord;
    level: 'Antardasha';
    start: string;
    end: string;
  }[];
};

export type LocalVimshottariDasha = {
  system: 'Vimshottari';
  timeline: VimshottariPeriod[];
  antarDasha: VimshottariPeriod['antardasha'][number] | null;
  current: {
    mahadasha: VimshottariPeriod | null;
    antardasha: VimshottariPeriod['antardasha'][number] | null;
  };
  birth: {
    nakshatraNumber: number;
    nakshatraLord: VimshottariLord;
    elapsedFraction: number;
    remainingFraction: number;
    remainingYears: number;
  };
  mahaDashaPrediction: null;
};

const LORDS: readonly VimshottariLord[] = [
  'Ketu',
  'Venus',
  'Sun',
  'Moon',
  'Mars',
  'Rahu',
  'Jupiter',
  'Saturn',
  'Mercury',
];

const YEARS: Record<VimshottariLord, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

const NAKSHATRA_SPAN = 360 / 27;
const VIMSHOTTARI_TOTAL_YEARS = 120;

// Tropical year keeps the calculation deterministic while avoiding
// calendar-month assumptions in fractional Dasha periods.
const DAYS_PER_YEAR = 365.2425;
const MS_PER_YEAR = DAYS_PER_YEAR * 24 * 60 * 60 * 1000;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function addYearsFraction(date: Date, years: number): Date {
  return new Date(date.getTime() + years * MS_PER_YEAR);
}

function toIso(date: Date): string {
  return date.toISOString();
}

function lordForNakshatra(nakshatraNumber: number): VimshottariLord {
  return LORDS[(nakshatraNumber - 1) % LORDS.length];
}

function createAntardasha(
  mahaLord: VimshottariLord,
  start: Date,
  end: Date,
): VimshottariPeriod['antardasha'] {
  const startIndex = LORDS.indexOf(mahaLord);

  if (startIndex < 0) {
    throw new Error(`Invalid Vimshottari lord: ${mahaLord}`);
  }

  const totalMs = end.getTime() - start.getTime();
  let cursor = start.getTime();

  return Array.from({ length: LORDS.length }, (_, index) => {
    const lord = LORDS[(startIndex + index) % LORDS.length];
    const isLast = index === LORDS.length - 1;

    const periodEnd = isLast
      ? end.getTime()
      : cursor + totalMs * (YEARS[lord] / VIMSHOTTARI_TOTAL_YEARS);

    const result = {
      lord,
      level: 'Antardasha' as const,
      start: toIso(new Date(cursor)),
      end: toIso(new Date(periodEnd)),
    };

    cursor = periodEnd;

    return result;
  });
}

export function calculateVimshottariDasha(
  moonSiderealLongitude: number,
  birthUtc: Date,
  referenceDate: Date = new Date(),
): LocalVimshottariDasha {
  if (!Number.isFinite(moonSiderealLongitude)) {
    throw new Error('Invalid Moon longitude for Vimshottari Dasha.');
  }

  if (Number.isNaN(birthUtc.getTime())) {
    throw new Error('Invalid birth UTC date for Vimshottari Dasha.');
  }

  if (Number.isNaN(referenceDate.getTime())) {
    throw new Error('Invalid reference date for Vimshottari Dasha.');
  }

  const moon = normalizeDegrees(moonSiderealLongitude);

  const nakshatraIndex = Math.floor(moon / NAKSHATRA_SPAN);
  const nakshatraNumber = nakshatraIndex + 1;

  const positionInsideNakshatra =
    moon - nakshatraIndex * NAKSHATRA_SPAN;

  const elapsedFraction =
    positionInsideNakshatra / NAKSHATRA_SPAN;

  const remainingFraction = 1 - elapsedFraction;

  const birthLord = lordForNakshatra(nakshatraNumber);
  const birthLordYears = YEARS[birthLord];

  const elapsedYearsAtBirth =
    birthLordYears * elapsedFraction;

  const remainingYears =
    birthLordYears * remainingFraction;

  // The Mahadasha began before birth according to how far the Moon
  // had already travelled through its birth Nakshatra.
  const firstStart =
    addYearsFraction(birthUtc, -elapsedYearsAtBirth);

  const timeline: VimshottariPeriod[] = [];

  const birthLordIndex = LORDS.indexOf(birthLord);
  let cursor = firstStart;

  // Generate two complete 120-year cycles. This safely covers normal
  // human lifetimes even when the first Mahadasha began before birth.
  for (let index = 0; index < LORDS.length * 2; index += 1) {
    const lord =
      LORDS[(birthLordIndex + index) % LORDS.length];

    const end =
      addYearsFraction(cursor, YEARS[lord]);

    timeline.push({
      lord,
      level: 'Mahadasha',
      start: toIso(cursor),
      end: toIso(end),
      antardasha: createAntardasha(
        lord,
        cursor,
        end,
      ),
    });

    cursor = end;
  }

  const currentMahadasha =
    timeline.find((period) => {
      const start = new Date(period.start).getTime();
      const end = new Date(period.end).getTime();
      const target = referenceDate.getTime();

      return target >= start && target < end;
    }) ?? null;

  const currentAntardasha =
    currentMahadasha?.antardasha.find((period) => {
      const start = new Date(period.start).getTime();
      const end = new Date(period.end).getTime();
      const target = referenceDate.getTime();

      return target >= start && target < end;
    }) ?? null;

  return {
    system: 'Vimshottari',
    timeline,
    antarDasha: currentAntardasha,
    current: {
      mahadasha: currentMahadasha,
      antardasha: currentAntardasha,
    },
    birth: {
      nakshatraNumber,
      nakshatraLord: birthLord,
      elapsedFraction,
      remainingFraction,
      remainingYears,
    },

    // No event-specific prediction is fabricated by the math engine.
    mahaDashaPrediction: null,
  };
}
