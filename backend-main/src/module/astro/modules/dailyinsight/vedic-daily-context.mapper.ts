export type NormalizedVedicPlanet = {
  name: string | null;
  shortName: string | null;
  sign: string | null;
  degree: number | string | null;
  house: number | string | null;
  retrograde: boolean;
  nakshatra: string | null;
};

export type VedicDailyContext = {
  requestedDate: string;
  requestedDay: 'yesterday' | 'today' | 'tomorrow';

  natal: {
    nakshatra: string | null;
    nakshatraNumber: number | null;
    nakshatraLord: string | null;
    planets: NormalizedVedicPlanet[];
    birthChart: unknown;
  };

  currentMoon: {
    nakshatra: string | null;
    nakshatraNumber: number | null;
    nakshatraLord: string | null;
    deity: string | null;
    pada: number | null;
  };

  transit: {
    date: string;
    localTime: string;
    timezone: number;
    timezoneName: string | null;
    planets: NormalizedVedicPlanet[];
  };

  dasha: {
    currentMahadasha: {
      lord: string | null;
      level: 'Mahadasha';
      start: string | null;
      end: string | null;
    } | null;

    currentAntardasha: {
      lord: string | null;
      level: 'Antardasha';
      start: string | null;
      end: string | null;
    } | null;

    dashaStartDate: string | null;
    remainingAtBirth: unknown;
  };

  tarabala: {
    name: string | null;
    count: number | null;
    effect: string | null;
  };

  providerPredictions: {
    general: string | null;
    career: string | null;
    relationships: string | null;
    health: string | null;
    finance: string | null;
  };

  providerGuidance: {
    luckyColors: string[];
    luckyNumbers: number[];
    favorableActivities: string[];
    avoidActivities: string[];
  };
};

export class VedicDailyContextMapper {
  private static unwrap(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const record = value as Record<string, unknown>;

    if ('data' in record && record.data !== undefined) {
      return this.unwrap(record.data);
    }

    if ('response' in record && record.response !== undefined) {
      return this.unwrap(record.response);
    }

    return value;
  }

  private static normalizePlanets(value: unknown): NormalizedVedicPlanet[] {
    const unwrapped = this.unwrap(value);

    let rawPlanets: Array<Record<string, unknown>> = [];

    if (
      unwrapped &&
      typeof unwrapped === 'object' &&
      !Array.isArray(unwrapped) &&
      Array.isArray((unwrapped as Record<string, unknown>).planet_position)
    ) {
      rawPlanets = (
        (unwrapped as Record<string, unknown>).planet_position as unknown[]
      ).filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      );
    } else if (Array.isArray(unwrapped)) {
      rawPlanets = unwrapped.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      );
    } else if (
      unwrapped &&
      typeof unwrapped === 'object' &&
      !Array.isArray(unwrapped)
    ) {
      rawPlanets = Object.entries(unwrapped as Record<string, unknown>)
        .filter(
          ([key, item]) =>
            /^\d+$/.test(key) &&
            Boolean(item) &&
            typeof item === 'object' &&
            !Array.isArray(item),
        )
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([, item]) => item as Record<string, unknown>);
    }

    return rawPlanets.map((planet) => ({
      name:
        typeof (planet.full_name ?? planet.name) === 'string'
          ? String(planet.full_name ?? planet.name)
          : null,

      shortName: typeof planet.name === 'string' ? planet.name : null,

      sign:
        typeof (planet.zodiac ?? planet.sign) === 'string'
          ? String(planet.zodiac ?? planet.sign)
          : planet.rasi &&
              typeof planet.rasi === 'object' &&
              !Array.isArray(planet.rasi) &&
              typeof (planet.rasi as Record<string, unknown>).name === 'string'
            ? String((planet.rasi as Record<string, unknown>).name)
            : null,

      degree:
        typeof (
          planet.local_degree ??
          planet.degree ??
          planet.global_degree
        ) === 'number' ||
        typeof (
          planet.local_degree ??
          planet.degree ??
          planet.global_degree
        ) === 'string'
          ? ((planet.local_degree ?? planet.degree ?? planet.global_degree) as
              | number
              | string)
          : null,

      house:
        typeof planet.house === 'number' || typeof planet.house === 'string'
          ? planet.house
          : null,

      retrograde: Boolean(planet.is_retrograde ?? planet.retro),

      nakshatra:
        typeof (planet.nakshatra ?? planet.nakshatra_name) === 'string'
          ? String(planet.nakshatra ?? planet.nakshatra_name)
          : null,
    }));
  }

  private static parseDashaDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const raw = value.trim();

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return new Date(
        Date.UTC(
          Number(isoMatch[1]),
          Number(isoMatch[2]) - 1,
          Number(isoMatch[3]),
        ),
      );
    }

    const dmyMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyMatch) {
      return new Date(
        Date.UTC(
          Number(dmyMatch[3]),
          Number(dmyMatch[2]) - 1,
          Number(dmyMatch[1]),
        ),
      );
    }

    const parsed = new Date(raw);

    return Number.isNaN(parsed.getTime())
      ? null
      : new Date(
          Date.UTC(
            parsed.getUTCFullYear(),
            parsed.getUTCMonth(),
            parsed.getUTCDate(),
          ),
        );
  }

  private static formatDashaDate(value: Date): string {
    const year = value.getUTCFullYear().toString();
    const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = value.getUTCDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private static buildAntardashaPeriods(
    mahaLord: string,
    startValue: string | null,
    endValue: string | null,
  ) {
    const start = this.parseDashaDate(startValue);
    const end = this.parseDashaDate(endValue);

    if (!start || !end || end.getTime() <= start.getTime()) {
      return [];
    }

    const vimshottariOrder = [
      'Ketu',
      'Venus',
      'Sun',
      'Moon',
      'Mars',
      'Rahu',
      'Jupiter',
      'Saturn',
      'Mercury',
    ] as const;

    const vimshottariYears: Record<string, number> = {
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

    const normalizedLord = mahaLord.trim();

    const startOrderIndex = vimshottariOrder.findIndex(
      (lord) => lord.toLowerCase() === normalizedLord.toLowerCase(),
    );

    if (startOrderIndex < 0) {
      return [];
    }

    const orderedLords = Array.from(
      { length: vimshottariOrder.length },
      (_, index) =>
        vimshottariOrder[(startOrderIndex + index) % vimshottariOrder.length],
    );

    const totalDurationMs = end.getTime() - start.getTime();
    let cursorMs = start.getTime();

    return orderedLords.map((subLord, index) => {
      const isLast = index === orderedLords.length - 1;
      const durationFraction = vimshottariYears[subLord] / 120;

      const calculatedEndMs = isLast
        ? end.getTime()
        : cursorMs + totalDurationMs * durationFraction;

      const periodStart = new Date(cursorMs);
      const periodEnd = new Date(calculatedEndMs);

      const period = {
        lord: subLord,
        level: 'Antardasha' as const,
        start: this.formatDashaDate(periodStart),
        end: this.formatDashaDate(periodEnd),
      };

      cursorMs = calculatedEndMs;

      return period;
    });
  }

  private static normalizeMahadasha(value: unknown, requestedDate: string) {
    const unwrapped = this.unwrap(value);

    if (
      !unwrapped ||
      typeof unwrapped !== 'object' ||
      Array.isArray(unwrapped)
    ) {
      return {
        currentMahadasha: null,
        currentAntardasha: null,
        dashaStartDate: null,
        remainingAtBirth: null,
      };
    }

    const data = unwrapped as Record<string, any>;

    /*
     * Prokerala returns the real Vimshottari hierarchy:
     *
     * dasha_periods[] -> antardasha[] -> pratyantardasha[]
     *
     * Do not reconstruct Antardasha mathematically when this hierarchy exists.
     */
    if (Array.isArray(data.dasha_periods)) {
      const targetDate = this.parseDashaDate(requestedDate) ?? new Date();

      const activeMahadasha =
        data.dasha_periods.find((period: any) => {
          const start = this.parseDashaDate(period?.start);
          const end = this.parseDashaDate(period?.end);

          return (
            start !== null &&
            end !== null &&
            targetDate.getTime() >= start.getTime() &&
            targetDate.getTime() < end.getTime()
          );
        }) ?? null;

      const activeAntardasha =
        activeMahadasha && Array.isArray(activeMahadasha.antardasha)
          ? activeMahadasha.antardasha.find((period: any) => {
              const start = this.parseDashaDate(period?.start);
              const end = this.parseDashaDate(period?.end);

              return (
                start !== null &&
                end !== null &&
                targetDate.getTime() >= start.getTime() &&
                targetDate.getTime() < end.getTime()
              );
            }) ?? null
          : null;

      return {
        currentMahadasha: activeMahadasha
          ? {
              lord:
                typeof activeMahadasha.name === 'string'
                  ? activeMahadasha.name
                  : null,
              level: 'Mahadasha' as const,
              start:
                typeof activeMahadasha.start === 'string'
                  ? activeMahadasha.start
                  : null,
              end:
                typeof activeMahadasha.end === 'string'
                  ? activeMahadasha.end
                  : null,
            }
          : null,

        currentAntardasha: activeAntardasha
          ? {
              lord:
                typeof activeAntardasha.name === 'string'
                  ? activeAntardasha.name
                  : null,
              level: 'Antardasha' as const,
              start:
                typeof activeAntardasha.start === 'string'
                  ? activeAntardasha.start
                  : null,
              end:
                typeof activeAntardasha.end === 'string'
                  ? activeAntardasha.end
                  : null,
            }
          : null,

        dashaStartDate:
          typeof data.dasha_periods[0]?.start === 'string'
            ? data.dasha_periods[0].start
            : null,

        remainingAtBirth: data.dasha_balance ?? null,
      };
    }

    // Legacy provider compatibility.
    const lords = Array.isArray(data.mahadasha) ? data.mahadasha : [];

    const endDates = Array.isArray(data.mahadasha_order)
      ? data.mahadasha_order
      : [];

    let currentStart =
      typeof data.dasha_start_date === 'string' ? data.dasha_start_date : null;

    const timeline = lords.map((lord: unknown, index: number) => {
      const normalizedLord =
        typeof lord === 'string' ? lord : String(lord ?? '');

      const end = typeof endDates[index] === 'string' ? endDates[index] : null;

      const children = this.buildAntardashaPeriods(
        normalizedLord,
        currentStart,
        end,
      );

      const period = {
        lord: normalizedLord,
        level: 'Mahadasha' as const,
        start: currentStart,
        end,
        children,
      };

      currentStart = end;

      return period;
    });

    const targetDate = this.parseDashaDate(requestedDate) ?? new Date();

    const activeMahadasha =
      timeline.find((period) => {
        const start = this.parseDashaDate(period.start);
        const end = this.parseDashaDate(period.end);

        return (
          start !== null &&
          end !== null &&
          targetDate.getTime() >= start.getTime() &&
          targetDate.getTime() < end.getTime()
        );
      }) ?? null;

    if (!activeMahadasha) {
      return {
        currentMahadasha: null,
        currentAntardasha: null,
        dashaStartDate:
          typeof data.dasha_start_date === 'string'
            ? data.dasha_start_date
            : null,
        remainingAtBirth: data.dasha_remaining_at_birth ?? null,
      };
    }

    const activeAntardasha =
      activeMahadasha.children.find((period) => {
        const start = this.parseDashaDate(period.start);
        const end = this.parseDashaDate(period.end);

        return (
          start !== null &&
          end !== null &&
          targetDate.getTime() >= start.getTime() &&
          targetDate.getTime() < end.getTime()
        );
      }) ?? null;

    return {
      currentMahadasha: {
        lord: activeMahadasha.lord || null,
        level: 'Mahadasha' as const,
        start: activeMahadasha.start ?? null,
        end: activeMahadasha.end ?? null,
      },

      currentAntardasha: activeAntardasha
        ? {
            lord: activeAntardasha.lord || null,
            level: 'Antardasha' as const,
            start: activeAntardasha.start ?? null,
            end: activeAntardasha.end ?? null,
          }
        : null,

      dashaStartDate:
        typeof data.dasha_start_date === 'string'
          ? data.dasha_start_date
          : null,

      remainingAtBirth: data.dasha_remaining_at_birth ?? null,
    };
  }
  private static stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private static numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private static stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private static numberArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (item): item is number =>
        typeof item === 'number' && Number.isFinite(item),
    );
  }

  static build(input: {
    requestedDate: string;
    requestedDay: 'yesterday' | 'today' | 'tomorrow';
    nakshatraDaily: unknown;
    birthChart: unknown;
    natalPlanetPositions: unknown;
    transitPlanetPositions: unknown;
    transitSnapshot: {
      date: string;
      localTime: string;
      timezone: number;
      timezoneName: string | null;
    };
    mahaDasha: unknown;
    panchang?: unknown;
  }): VedicDailyContext {
    const dailyRaw = this.unwrap(input.nakshatraDaily);

    const daily =
      dailyRaw && typeof dailyRaw === 'object' && !Array.isArray(dailyRaw)
        ? (dailyRaw as Record<string, any>)
        : {};

    const dasha = this.normalizeMahadasha(input.mahaDasha, input.requestedDate);

    const kundliRaw = this.unwrap(input.birthChart);
    const kundli =
      kundliRaw && typeof kundliRaw === 'object' && !Array.isArray(kundliRaw)
        ? (kundliRaw as Record<string, any>)
        : {};

    const natalDetails =
      kundli.nakshatra_details &&
      typeof kundli.nakshatra_details === 'object' &&
      !Array.isArray(kundli.nakshatra_details)
        ? kundli.nakshatra_details
        : {};

    const natalNakshatra =
      natalDetails.nakshatra &&
      typeof natalDetails.nakshatra === 'object' &&
      !Array.isArray(natalDetails.nakshatra)
        ? natalDetails.nakshatra
        : {};

    const panchangRaw = this.unwrap(input.panchang);
    const panchang =
      panchangRaw && typeof panchangRaw === 'object' && !Array.isArray(panchangRaw)
        ? (panchangRaw as Record<string, any>)
        : {};

    const timezone = Number(input.transitSnapshot.timezone);
    const sign = timezone >= 0 ? '+' : '-';
    const absoluteTimezone = Math.abs(timezone);
    const timezoneHours = Math.floor(absoluteTimezone);
    const timezoneMinutes = Math.round(
      (absoluteTimezone - timezoneHours) * 60,
    );

    const offset =
      sign +
      String(timezoneHours).padStart(2, '0') +
      ':' +
      String(timezoneMinutes).padStart(2, '0');

    const targetInstant = new Date(
      `${input.transitSnapshot.date}T${input.transitSnapshot.localTime}${offset}`,
    );

    const panchangNakshatras = Array.isArray(panchang.nakshatra)
      ? panchang.nakshatra.filter(
          (item: unknown): item is Record<string, any> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item),
        )
      : [];

    const activeNakshatra =
      panchangNakshatras.find((item) => {
        const start =
          typeof item.start === 'string' ? new Date(item.start) : null;
        const end = typeof item.end === 'string' ? new Date(item.end) : null;

        return Boolean(
          start &&
            end &&
            !Number.isNaN(start.getTime()) &&
            !Number.isNaN(end.getTime()) &&
            targetInstant.getTime() >= start.getTime() &&
            targetInstant.getTime() <= end.getTime(),
        );
      }) ?? null;

    const activeLord =
      activeNakshatra?.lord &&
      typeof activeNakshatra.lord === 'object' &&
      !Array.isArray(activeNakshatra.lord)
        ? activeNakshatra.lord
        : {};

    const natalLord =
      natalNakshatra.lord &&
      typeof natalNakshatra.lord === 'object' &&
      !Array.isArray(natalNakshatra.lord)
        ? natalNakshatra.lord
        : {};

    return {
      requestedDate: input.requestedDate,
      requestedDay: input.requestedDay,

      natal: {
        nakshatra: this.stringOrNull(natalNakshatra.name) ?? this.stringOrNull(daily?.natal_moon?.nakshatra),
        nakshatraNumber: this.numberOrNull(natalNakshatra.id) ?? this.numberOrNull(daily?.natal_moon?.nakshatra_number),
        nakshatraLord: this.stringOrNull(natalLord.name) ?? this.stringOrNull(daily?.natal_moon?.nakshatra_lord),
        planets: this.normalizePlanets(input.natalPlanetPositions),
        birthChart: this.unwrap(input.birthChart),
      },

      currentMoon: {
        nakshatra: this.stringOrNull(activeNakshatra?.name) ?? this.stringOrNull(daily?.current_moon?.nakshatra),
        nakshatraNumber:
          this.numberOrNull(activeNakshatra?.id) ??
          this.numberOrNull(daily?.current_moon?.nakshatra_number),
        nakshatraLord: this.stringOrNull(activeLord.name) ?? this.stringOrNull(daily?.current_moon?.nakshatra_lord),
        deity: this.stringOrNull(daily?.current_moon?.nakshatra_deity),
        pada: this.numberOrNull(daily?.current_moon?.pada),
      },

      transit: {
        date: input.transitSnapshot.date,
        localTime: input.transitSnapshot.localTime,
        timezone: input.transitSnapshot.timezone,
        timezoneName: input.transitSnapshot.timezoneName,
        planets: this.normalizePlanets(input.transitPlanetPositions),
      },

      dasha: {
        currentMahadasha: dasha.currentMahadasha,
        currentAntardasha: dasha.currentAntardasha,
        dashaStartDate: dasha.dashaStartDate,
        remainingAtBirth: dasha.remainingAtBirth,
      },

      tarabala: this.calculateTarabala(
        this.numberOrNull(natalNakshatra.id) ??
          this.numberOrNull(daily?.natal_moon?.nakshatra_number),
        this.numberOrNull(activeNakshatra?.id) ??
          this.numberOrNull(daily?.current_moon?.nakshatra_number),
      ),

      providerPredictions: {
        general: this.stringOrNull(daily?.predictions?.general),
        career: this.stringOrNull(daily?.predictions?.career),
        relationships: this.stringOrNull(daily?.predictions?.relationships),
        health: this.stringOrNull(daily?.predictions?.health),
        finance: this.stringOrNull(daily?.predictions?.finance),
      },

      providerGuidance: {
        luckyColors: this.stringArray(daily?.guidance?.lucky_colors),
        luckyNumbers: this.numberArray(daily?.guidance?.lucky_numbers),
        favorableActivities: this.stringArray(
          daily?.guidance?.favorable_activities,
        ),
        avoidActivities: this.stringArray(daily?.guidance?.avoid_activities),
      },
    };
  }

  private static calculateTarabala(
    natalNakshatraId: number | null,
    currentNakshatraId: number | null,
  ): {
    name: string | null;
    count: number | null;
    effect: string | null;
  } {
    if (
      natalNakshatraId === null ||
      currentNakshatraId === null ||
      !Number.isInteger(natalNakshatraId) ||
      !Number.isInteger(currentNakshatraId) ||
      natalNakshatraId < 0 ||
      natalNakshatraId > 26 ||
      currentNakshatraId < 0 ||
      currentNakshatraId > 26
    ) {
      return {
        name: null,
        count: null,
        effect: null,
      };
    }

    // Prokerala Nakshatra IDs are zero-based (0..26).
    // Tarabala counting is inclusive from the natal Nakshatra.
    const distance =
      ((currentNakshatraId - natalNakshatraId + 27) % 27) + 1;

    const taraCount = ((distance - 1) % 9) + 1;

    const tara = [
      {
        name: 'Janma',
        effect: 'Mixed; maintain steadiness and avoid unnecessary strain.',
      },
      {
        name: 'Sampat',
        effect: 'Favorable for resources, gains and practical progress.',
      },
      {
        name: 'Vipat',
        effect: 'Caution is advised; avoid unnecessary risks and haste.',
      },
      {
        name: 'Kshema',
        effect: 'Supportive for wellbeing, stability and constructive activity.',
      },
      {
        name: 'Pratyari',
        effect: 'Potential for obstacles or resistance; proceed thoughtfully.',
      },
      {
        name: 'Sadhaka',
        effect: 'Favorable for achievement, focused effort and completing goals.',
      },
      {
        name: 'Naidhana',
        effect: 'Less supportive; prefer caution and avoid major unnecessary risks.',
      },
      {
        name: 'Mitra',
        effect: 'Supportive for cooperation, relationships and useful progress.',
      },
      {
        name: 'Parama Mitra',
        effect: 'Highly supportive for confidence, cooperation and positive activity.',
      },
    ][taraCount - 1];

    return {
      name: tara.name,
      count: taraCount,
      effect: tara.effect,
    };
  }}





