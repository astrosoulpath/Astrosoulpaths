type UnknownRecord = Record<string, unknown>;

export type TodayForYouLifeArea = {
  key: string;
  title: string;
  guidance: string | null;
};

export type TodayForYouEvidence = {
  key: string;
  label: string;
  value: string;
  source: 'vedic-calculation' | 'provider';
};

export type TodayForYouTiming = {
  sunrise: string | null;
  sunset: string | null;
  rahuKaal: string | null;
  abhijitMuhurat: string | null;
};

export type TodayForYouPanchang = {
  tithi: string | null;
  nakshatra: string | null;
  yoga: string | null;
  karana: string | null;
};

export type TodayForYouResult = {
  title: 'Today For YOU';

  requestedDate: string | null;

  overallScore: number | null;

  headline: string | null;

  dailyAdvice: string | null;

  currentPhase: {
    mahadasha: string | null;
    antardasha: string | null;
  };

  lifeAreas: TodayForYouLifeArea[];

  timing: TodayForYouTiming;

  panchang: TodayForYouPanchang;

  whyToday: TodayForYouEvidence[];

  transparency: {
    scoreSource: 'vedic-calculation' | null;
    usesNatalChart: boolean;
    usesCurrentMoon: boolean;
    usesTransit: boolean;
    usesDasha: boolean;
    usesTarabala: boolean;
    usesPanchang: boolean;
    aiRole: 'interpretation-only';
  };
};

export class TodayForYouMapper {
  static build(input: {
    mappedDailyInsight: unknown;
    vedicContext: unknown;
    panchang: unknown;
    ai: unknown;
  }): TodayForYouResult {
    const mapped = this.record(input.mappedDailyInsight);
    const vedic = this.record(input.vedicContext);
    const ai = this.record(input.ai);

    const panchang = this.unwrapRecord(input.panchang);

    const cosmic = this.record(mapped.cosmic);
    const dasha = this.record(vedic.dasha);

    const currentMahadasha = this.record(dasha.currentMahadasha);
    const currentAntardasha = this.record(dasha.currentAntardasha);

    const currentMoon = this.record(vedic.currentMoon);
    const natal = this.record(vedic.natal);
    const transit = this.record(vedic.transit);
    const tarabala = this.record(vedic.tarabala);

    const overallScore = this.calculateCosmicScore(tarabala);

    const lifeAreas = this.normalizeLifeAreas(mapped.lifeAreas);

    const timing: TodayForYouTiming = {
      sunrise: this.findString(panchang, [
        ['sunrise'],
        ['day', 'sunrise'],
        ['sun', 'sunrise'],
      ]),

      sunset: this.findString(panchang, [
        ['sunset'],
        ['day', 'sunset'],
        ['sun', 'sunset'],
      ]),

      rahuKaal: this.findTimeWindow(panchang, [
        ['rahu_kaal'],
        ['rahukaal'],
        ['rahuKaal'],
        ['inauspicious', 'rahu_kaal'],
        ['inauspicious', 'rahukaal'],
      ]),

      abhijitMuhurat: this.findTimeWindow(panchang, [
        ['abhijit'],
        ['abhijit_muhurat'],
        ['abhijitMuhurat'],
        ['muhurta', 'abhijit'],
        ['muhurat', 'abhijit'],
      ]),
    };

    const panchangSummary: TodayForYouPanchang = {
      tithi: this.findNamedValue(panchang, [['tithi']]),

      nakshatra: this.findNamedValue(panchang, [['nakshatra']]),

      yoga: this.findNamedValue(panchang, [['yoga']]),

      karana: this.findNamedValue(panchang, [['karana'], ['karanam']]),
    };

    const evidence: TodayForYouEvidence[] = [];

    this.pushEvidence(
      evidence,
      'natal-nakshatra',
      'Natal Nakshatra',
      this.stringOrNull(natal.nakshatra),
      'vedic-calculation',
    );

    this.pushEvidence(
      evidence,
      'current-moon',
      'Current Moon Nakshatra',
      this.stringOrNull(currentMoon.nakshatra),
      'vedic-calculation',
    );

    this.pushEvidence(
      evidence,
      'tarabala',
      'Tarabala',
      this.tarabalaText(tarabala),
      'vedic-calculation',
    );

    this.pushEvidence(
      evidence,
      'mahadasha',
      'Mahadasha',
      this.stringOrNull(currentMahadasha.lord),
      'vedic-calculation',
    );

    this.pushEvidence(
      evidence,
      'antardasha',
      'Antardasha',
      this.stringOrNull(currentAntardasha.lord),
      'vedic-calculation',
    );

    this.pushEvidence(
      evidence,
      'tithi',
      'Tithi',
      panchangSummary.tithi,
      'provider',
    );

    this.pushEvidence(
      evidence,
      'yoga',
      'Yoga',
      panchangSummary.yoga,
      'provider',
    );

    return {
      title: 'Today For YOU',

      requestedDate:
        this.stringOrNull(vedic.requestedDate) ??
        this.stringOrNull(mapped.requestedDate),

      overallScore,

      headline:
        this.stringOrNull(ai.shortReading) ??
        this.stringOrNull(mapped.shortReading),

      dailyAdvice:
        this.stringOrNull(ai.dailyAdvice) ??
        this.stringOrNull(this.record(mapped.dailyHighlights).dailyAdvice),

      currentPhase: {
        mahadasha: this.stringOrNull(currentMahadasha.lord),
        antardasha: this.stringOrNull(currentAntardasha.lord),
      },

      lifeAreas,

      timing,

      panchang: panchangSummary,

      whyToday: evidence,

      transparency: {
        scoreSource: overallScore === null ? null : 'vedic-calculation',

        usesNatalChart:
          this.hasMeaningfulObject(natal) || Array.isArray(natal.planets),

        usesCurrentMoon: this.hasMeaningfulObject(currentMoon),

        usesTransit:
          Array.isArray(transit.planets) && transit.planets.length > 0,

        usesDasha: Boolean(
          this.stringOrNull(currentMahadasha.lord) ||
          this.stringOrNull(currentAntardasha.lord),
        ),

        usesTarabala: this.hasMeaningfulObject(tarabala),

        usesPanchang: Boolean(
          panchangSummary.tithi ||
          panchangSummary.nakshatra ||
          panchangSummary.yoga ||
          panchangSummary.karana ||
          timing.sunrise ||
          timing.sunset ||
          timing.rahuKaal ||
          timing.abhijitMuhurat,
        ),

        aiRole: 'interpretation-only',
      },
    };
  }

  private static record(value: unknown): UnknownRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as UnknownRecord;
    }

    return {};
  }

  private static unwrapRecord(value: unknown): UnknownRecord {
    const record = this.record(value);

    const data = this.record(record.data);

    if (Object.keys(data).length > 0) {
      return data;
    }

    const response = this.record(record.response);

    if (Object.keys(response).length > 0) {
      return response;
    }

    return record;
  }

  private static stringOrNull(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized ? normalized : null;
  }

  /**
   * ASP Cosmic Score v1
   *
   * Product-defined deterministic index based on the calculated Tarabala
   * category. It deliberately uses broad score bands rather than fake
   * precision.
   *
   * No AI, randomness, user-specific hardcoding or provider percentage.
   * Missing/unrecognised Vedic evidence => null.
   */
  private static calculateCosmicScore(
    tarabala: Record<string, unknown>,
  ): number | null {
    const name = this.stringOrNull(tarabala.name);

    if (!name) {
      return null;
    }

    const scoreByTara: Record<string, number> = {
      Janma: 55,
      Sampat: 80,
      Vipat: 40,
      Kshema: 80,
      Pratyari: 40,
      Sadhaka: 80,
      Naidhana: 30,
      Mitra: 80,
      'Parama Mitra': 90,
    };

    return scoreByTara[name] ?? null;
  }
  private static numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private static normalizeLifeAreas(value: unknown): TodayForYouLifeArea[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const area = this.record(item);

        const title = this.stringOrNull(area.title);

        if (!title) {
          return null;
        }

        return {
          key: title
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),

          title,

          guidance: this.stringOrNull(area.description),
        };
      })
      .filter((item): item is TodayForYouLifeArea => item !== null);
  }

  private static getPath(source: UnknownRecord, path: string[]): unknown {
    let current: unknown = source;

    for (const key of path) {
      const record = this.record(current);

      if (!(key in record)) {
        return undefined;
      }

      current = record[key];
    }

    return current;
  }

  private static findString(
    source: UnknownRecord,
    paths: string[][],
  ): string | null {
    for (const path of paths) {
      const value = this.getPath(source, path);

      const stringValue = this.stringOrNull(value);

      if (stringValue) {
        return stringValue;
      }
    }

    return null;
  }

  private static findNamedValue(
    source: UnknownRecord,
    paths: string[][],
  ): string | null {
    for (const path of paths) {
      const value = this.getPath(source, path);

      const direct = this.stringOrNull(value);

      if (direct) {
        return direct;
      }

      const record = this.record(value);

      const name =
        this.stringOrNull(record.name) ?? this.stringOrNull(record.title);

      if (name) {
        return name;
      }
    }

    return null;
  }

  private static findTimeWindow(
    source: UnknownRecord,
    paths: string[][],
  ): string | null {
    for (const path of paths) {
      const value = this.getPath(source, path);

      const direct = this.stringOrNull(value);

      if (direct) {
        return direct;
      }

      const record = this.record(value);

      if (Object.keys(record).length === 0) {
        continue;
      }

      const start =
        this.stringOrNull(record.start) ??
        this.stringOrNull(record.starts_at) ??
        this.stringOrNull(record.start_time) ??
        this.stringOrNull(record.from);

      const end =
        this.stringOrNull(record.end) ??
        this.stringOrNull(record.ends_at) ??
        this.stringOrNull(record.end_time) ??
        this.stringOrNull(record.to);

      if (start && end) {
        return `${start} - ${end}`;
      }

      if (start) {
        return start;
      }

      if (end) {
        return end;
      }
    }

    return null;
  }

  private static tarabalaText(tarabala: UnknownRecord): string | null {
    const name = this.stringOrNull(tarabala.name);
    const effect = this.stringOrNull(tarabala.effect);

    if (name && effect) {
      return `${name} - ${effect}`;
    }

    return name ?? effect;
  }

  private static pushEvidence(
    target: TodayForYouEvidence[],
    key: string,
    label: string,
    value: string | null,
    source: TodayForYouEvidence['source'],
  ): void {
    if (!value) {
      return;
    }

    target.push({
      key,
      label,
      value,
      source,
    });
  }

  private static hasMeaningfulObject(value: UnknownRecord): boolean {
    return Object.values(value).some((item) => {
      if (item === null || item === undefined) {
        return false;
      }

      if (typeof item === 'string') {
        return item.trim().length > 0;
      }

      if (Array.isArray(item)) {
        return item.length > 0;
      }

      if (typeof item === 'object') {
        return Object.keys(item as Record<string, unknown>).length > 0;
      }

      return true;
    });
  }
}


