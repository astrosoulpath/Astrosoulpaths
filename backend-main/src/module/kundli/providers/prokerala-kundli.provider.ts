import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

import { AstroParams } from '../../../common/types/astro-params.type';
import { ProkeralaProvider } from '../../astro/modules/provider/prokerala.provider';

import type { IKundliProvider } from './interfaces/kundli-provider.interface';
import type {
  KundliDashaPeriod,
  KundliReport,
} from '../types/kundli-report.type';

@Injectable()
export class ProkeralaKundliProvider implements IKundliProvider {
  private readonly logger = new Logger(ProkeralaKundliProvider.name);

  constructor(private readonly prokerala: ProkeralaProvider) {}

  private unwrap(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const root = value as Record<string, any>;

    if (
      root.data &&
      typeof root.data === 'object' &&
      !Array.isArray(root.data)
    ) {
      return root.data as Record<string, any>;
    }

    return root;
  }

  private valueOf<T>(label: string, result: PromiseSettledResult<T>): T | null {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const message =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason ?? 'Unknown provider error');

    this.logger.warn(
      `kundli.prokerala.section_unavailable section=${label} message=${message}`,
    );

    return null;
  }

  private normalizeChart(
    value: unknown,
    division: string,
    chartName: string,
  ): Record<string, unknown> | null {
    if (typeof value === 'string') {
      const svg = value.trim();

      if (!svg || !svg.toLowerCase().includes('<svg')) {
        return null;
      }

      return {
        chart_type: division,
        chart_name: chartName,
        chart_style: 'NORTH_INDIAN',
        format: 'svg',
        svg,
      };
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const root = value as Record<string, any>;

      const possibleSvg =
        typeof root.svg === 'string'
          ? root.svg
          : typeof root.chart === 'string' &&
              root.chart.toLowerCase().includes('<svg')
            ? root.chart
            : typeof root.data === 'string' &&
                root.data.toLowerCase().includes('<svg')
              ? root.data
              : null;

      if (possibleSvg) {
        return {
          chart_type: division,
          chart_name: chartName,
          chart_style: 'NORTH_INDIAN',
          format: 'svg',
          svg: possibleSvg.trim(),
        };
      }

      /*
       * Keep compatibility with any structured provider response.
       * Never fabricate houses or planet placements.
       */
      return {
        ...root,
        chart_type: root.chart_type ?? division,
        chart_name: root.chart_name ?? chartName,
      };
    }

    return null;
  }
  /**
   * Derives the classical 27-Nakshatra position from the
   * sidereal longitude returned by Prokerala.
   *
   * This does NOT manufacture customer astrology data.
   * The astronomical longitude remains Prokerala's result;
   * this only converts that longitude into its standard
   * Vedic Nakshatra segment and Pada.
   */
  private deriveNakshatraFromLongitude(longitude: unknown): {
    name: string;
    pada: number;
    number: number;
  } | null {
    const numericLongitude = Number(longitude);

    if (!Number.isFinite(numericLongitude)) {
      return null;
    }

    const normalized = ((numericLongitude % 360) + 360) % 360;

    const names = [
      'Ashwini',
      'Bharani',
      'Krittika',
      'Rohini',
      'Mrigashira',
      'Ardra',
      'Punarvasu',
      'Pushya',
      'Ashlesha',
      'Magha',
      'Purva Phalguni',
      'Uttara Phalguni',
      'Hasta',
      'Chitra',
      'Swati',
      'Vishakha',
      'Anuradha',
      'Jyeshtha',
      'Mula',
      'Purva Ashadha',
      'Uttara Ashadha',
      'Shravana',
      'Dhanishta',
      'Shatabhisha',
      'Purva Bhadrapada',
      'Uttara Bhadrapada',
      'Revati',
    ] as const;

    // 360 / 27 = 13 deg 20 min per Nakshatra.
    const nakshatraSize = 360 / 27;

    // Each Nakshatra has four equal Padas.
    const padaSize = nakshatraSize / 4;

    const index = Math.min(26, Math.floor(normalized / nakshatraSize));

    const withinNakshatra = normalized - index * nakshatraSize;

    const pada = Math.min(4, Math.floor(withinNakshatra / padaSize) + 1);

    return {
      name: names[index],
      pada,
      number: index + 1,
    };
  }
  private normalizePlanetaryPositions(
    value: unknown,
  ): Array<Record<string, any>> {
    const data = this.unwrap(value);

    const rows = Array.isArray(data.planet_position)
      ? data.planet_position
      : Array.isArray(data.planetPositions)
        ? data.planetPositions
        : Array.isArray(value)
          ? value
          : [];

    return rows
      .filter(
        (planet): planet is Record<string, any> =>
          Boolean(planet) &&
          typeof planet === 'object' &&
          !Array.isArray(planet),
      )
      .map((planet) => {
        const rasi =
          planet.rasi &&
          typeof planet.rasi === 'object' &&
          !Array.isArray(planet.rasi)
            ? (planet.rasi as Record<string, any>)
            : {};

        const nakshatra =
          planet.nakshatra &&
          typeof planet.nakshatra === 'object' &&
          !Array.isArray(planet.nakshatra)
            ? (planet.nakshatra as Record<string, any>)
            : {};

        const nakshatraLord =
          nakshatra.lord &&
          typeof nakshatra.lord === 'object' &&
          !Array.isArray(nakshatra.lord)
            ? (nakshatra.lord as Record<string, any>)
            : {};

        const signLord =
          rasi.lord &&
          typeof rasi.lord === 'object' &&
          !Array.isArray(rasi.lord)
            ? (rasi.lord as Record<string, any>)
            : {};

        const longitude =
          typeof planet.longitude === 'number'
            ? planet.longitude
            : typeof planet.degree === 'number'
              ? planet.degree
              : null;

        /*
         * Degree inside sign is safe to calculate from absolute longitude.
         * This is arithmetic normalization only, not an astrology inference.
         */
        const degreeInSign =
          typeof longitude === 'number' ? ((longitude % 30) + 30) % 30 : null;

        const derivedNakshatra = this.deriveNakshatraFromLongitude(longitude);

        const nakshatraName =
          typeof nakshatra.name === 'string' && nakshatra.name.trim().length > 0
            ? nakshatra.name.trim()
            : typeof planet.nakshatra_name === 'string' &&
                planet.nakshatra_name.trim().length > 0
              ? planet.nakshatra_name.trim()
              : (derivedNakshatra?.name ?? null);

        const pada =
          typeof nakshatra.pada === 'number'
            ? nakshatra.pada
            : typeof planet.nakshatra_pada === 'number'
              ? planet.nakshatra_pada
              : (derivedNakshatra?.pada ?? null);

        const nakshatraNumber =
          typeof nakshatra.id === 'number'
            ? nakshatra.id
            : (derivedNakshatra?.number ?? null);

        return {
          id: planet.id ?? null,

          name: typeof planet.name === 'string' ? planet.name : null,

          sign:
            typeof rasi.name === 'string'
              ? rasi.name
              : typeof planet.sign === 'string'
                ? planet.sign
                : null,

          sign_no: typeof rasi.id === 'number' ? rasi.id : null,

          rasi_no: typeof rasi.id === 'number' ? rasi.id : null,

          signLord: typeof signLord.name === 'string' ? signLord.name : null,

          longitude,

          absolute_degree: longitude,

          degree: degreeInSign,

          degree_in_sign: degreeInSign,

          nakshatra: nakshatraName,

          nakshatra_pada: pada,

          nakshatra_number: nakshatraNumber,

          nakshatra_lord:
            typeof nakshatraLord.name === 'string' ? nakshatraLord.name : null,

          is_retrograde: Boolean(
            planet.is_retrograde ?? planet.isRetrograde ?? false,
          ),

          retrograde: Boolean(
            planet.is_retrograde ?? planet.isRetrograde ?? false,
          ),

          /*
           * CRITICAL:
           * Prokerala planet `position` is NOT treated as ASP house.
           *
           * House remains null until a verified house/cusp source is mapped.
           */
          house: null,

          raw: planet,
        };
      });
  }

  /**
   * Attach authoritative D1/Lagna house numbers returned by Prokerala.
   * No local sign-to-house calculation is performed.
   */
  private applyDivisionalHouses(
    planets: Array<Record<string, any>>,
    value: unknown,
  ): Array<Record<string, any>> {
    const data = this.unwrap(value);

    const divisions = Array.isArray(data.divisional_positions)
      ? data.divisional_positions
      : Array.isArray(data.divisionalPositions)
        ? data.divisionalPositions
        : [];

    const housesById = new Map<string, number>();
    const housesByName = new Map<string, number>();

    const normalizeName = (value: unknown): string | null => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : null;
    };

    const normalizeHouse = (value: unknown): number | null => {
      const number = Number(value);

      if (!Number.isInteger(number) || number < 1 || number > 12) {
        return null;
      }

      return number;
    };

    for (const rawDivision of divisions) {
      if (
        !rawDivision ||
        typeof rawDivision !== 'object' ||
        Array.isArray(rawDivision)
      ) {
        continue;
      }

      const division = rawDivision as Record<string, any>;

      const positions = Array.isArray(division.planet_positions)
        ? division.planet_positions
        : Array.isArray(division.planetPositions)
          ? division.planetPositions
          : [];

      for (const rawPosition of positions) {
        if (
          !rawPosition ||
          typeof rawPosition !== 'object' ||
          Array.isArray(rawPosition)
        ) {
          continue;
        }

        const position = rawPosition as Record<string, any>;

        const planet =
          position.planet &&
          typeof position.planet === 'object' &&
          !Array.isArray(position.planet)
            ? (position.planet as Record<string, any>)
            : {};

        const house =
          position.house &&
          typeof position.house === 'object' &&
          !Array.isArray(position.house)
            ? (position.house as Record<string, any>)
            : {};

        const houseNumber = normalizeHouse(
          house.number ?? position.house_number ?? position.houseNumber,
        );

        if (houseNumber === null) {
          continue;
        }

        if (planet.id !== null && planet.id !== undefined) {
          housesById.set(String(planet.id), houseNumber);
        }

        for (const name of [planet.name, planet.vedic_name, planet.full_name]) {
          const normalized = normalizeName(name);

          if (normalized) {
            housesByName.set(normalized, houseNumber);
          }
        }
      }
    }

    return planets.map((planet) => {
      const raw =
        planet.raw &&
        typeof planet.raw === 'object' &&
        !Array.isArray(planet.raw)
          ? (planet.raw as Record<string, any>)
          : {};

      const rawPlanet =
        raw.planet &&
        typeof raw.planet === 'object' &&
        !Array.isArray(raw.planet)
          ? (raw.planet as Record<string, any>)
          : raw;

      let verifiedHouse: number | null = null;

      for (const id of [planet.id, rawPlanet.id, raw.planet_id, raw.planetId]) {
        if (id === null || id === undefined) {
          continue;
        }

        const found = housesById.get(String(id));

        if (found !== undefined) {
          verifiedHouse = found;
          break;
        }
      }

      if (verifiedHouse === null) {
        for (const name of [
          planet.name,
          planet.vedic_name,
          planet.full_name,
          rawPlanet.name,
          rawPlanet.vedic_name,
          rawPlanet.full_name,
        ]) {
          const normalized = normalizeName(name);

          if (!normalized) {
            continue;
          }

          const found = housesByName.get(normalized);

          if (found !== undefined) {
            verifiedHouse = found;
            break;
          }
        }
      }

      return {
        ...planet,
        house: verifiedHouse,
      };
    });
  }
  private normalizePanchang(value: unknown): Record<string, any> | null {
    const data = this.unwrap(value);

    if (Object.keys(data).length === 0) {
      return null;
    }

    const nameOf = (value: unknown): string | null => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const row = value as Record<string, any>;

        for (const key of ['name', 'title', 'value']) {
          if (typeof row[key] === 'string' && row[key].trim()) {
            return row[key].trim();
          }
        }
      }

      return null;
    };

    const selectEntry = (value: unknown): unknown => {
      if (!Array.isArray(value)) {
        return value;
      }

      if (value.length === 0) {
        return null;
      }

      /*
       * Without a verified target-time match, do not randomly select
       * among multiple Panchang intervals.
       *
       * A single-item result is unambiguous and safe.
       */
      if (value.length === 1) {
        return value[0];
      }

      return null;
    };

    const tithiRaw = selectEntry(data.tithi ?? data.tithis);

    const nakshatraRaw = selectEntry(data.nakshatra ?? data.nakshatras);

    const yogaRaw = selectEntry(data.yoga ?? data.yogas);

    const karanaRaw = selectEntry(data.karana ?? data.karanas);

    const ayanamsaRaw =
      data.ayanamsa ??
      data.ayanamsha ??
      data.ayanamsa_name ??
      data.ayanamsha_name ??
      'Lahiri';

    return {
      tithi: nameOf(tithiRaw),
      tithi_name: nameOf(tithiRaw),

      nakshatra: nameOf(nakshatraRaw),
      nakshatra_name: nameOf(nakshatraRaw),

      yoga: nameOf(yogaRaw),
      yoga_name: nameOf(yogaRaw),

      karana: nameOf(karanaRaw),
      karana_name: nameOf(karanaRaw),

      ayanamsa: nameOf(ayanamsaRaw) ?? 'Lahiri',

      sunrise: data.sunrise ?? data.sun_rise ?? null,

      sunset: data.sunset ?? data.sun_set ?? null,

      raw: data,
    };
  }
  private normalizeDasha(value: unknown) {
    const data = this.unwrap(value);

    const periods = Array.isArray(data.dasha_periods) ? data.dasha_periods : [];

    const normalizePeriod = (
      period: unknown,
      level: string,
    ): KundliDashaPeriod | null => {
      if (!period || typeof period !== 'object' || Array.isArray(period)) {
        return null;
      }

      const row = period as Record<string, any>;

      const childSource = Array.isArray(row.antardasha)
        ? row.antardasha
        : Array.isArray(row.pratyantardasha)
          ? row.pratyantardasha
          : Array.isArray(row.children)
            ? row.children
            : [];

      const nextLevel =
        level === 'Mahadasha'
          ? 'Antardasha'
          : level === 'Antardasha'
            ? 'Pratyantardasha'
            : 'Subperiod';

      const children = childSource
        .map((child) => normalizePeriod(child, nextLevel))
        .filter((child): child is KundliDashaPeriod => child !== null);

      const lord =
        typeof row.name === 'string'
          ? row.name
          : typeof row.lord === 'string'
            ? row.lord
            : row.planet &&
                typeof row.planet === 'object' &&
                !Array.isArray(row.planet)
              ? (row.planet.name ?? null)
              : null;

      return {
        lord,
        level,
        start:
          typeof row.start === 'string'
            ? row.start
            : typeof row.start_date === 'string'
              ? row.start_date
              : null,

        end:
          typeof row.end === 'string'
            ? row.end
            : typeof row.end_date === 'string'
              ? row.end_date
              : null,

        children,
      };
    };

    const timeline = periods
      .map((period) => normalizePeriod(period, 'Mahadasha'))
      .filter((period): period is KundliDashaPeriod => period !== null);

    const now = Date.now();

    const activeMahadasha =
      timeline.find((period) => {
        const start = period.start ? Date.parse(period.start) : NaN;
        const end = period.end ? Date.parse(period.end) : NaN;

        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          now >= start &&
          now < end
        );
      }) ?? null;

    const activeAntardasha =
      activeMahadasha?.children?.find((period) => {
        const start = period.start ? Date.parse(period.start) : NaN;
        const end = period.end ? Date.parse(period.end) : NaN;

        return (
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          now >= start &&
          now < end
        );
      }) ?? null;

    return {
      timeline,
      mahaDasha: data,
      mahaDashaPrediction: null,
      antarDasha: activeMahadasha?.children ?? [],
      current: {
        dashaBalance: data.dasha_balance ?? null,
        mahaDasha: activeMahadasha,
        antarDasha: activeAntardasha,
      },
    };
  }

  async generate(params: AstroParams, lang = 'en'): Promise<KundliReport> {
    const providerParams: AstroParams = {
      ...params,
      lang,
    };

    this.logger.log(`kundli.generate.start provider=prokerala lang=${lang}`);

    /*
     * Only verified Prokerala wrapper methods are used here.
     *
     * No OpenAI calculation.
     * No dummy data.
     * No fallback-generated astrology values.
     */
    /*
     * Prokerala rate-limit protection.
     *
     * Keep every existing astrology section, but never burst all
     * upstream requests in parallel.
     *
     * 13 seconds between requests keeps this flow at fewer than
     * 5 requests per rolling minute.
     */
    /*
     * Customer Kundli core calculation.
     *
     * Prokerala Advanced Kundli already supplies:
     * - Nakshatra details
     * - Mangal Dosha
     * - Yogas
     * - Dasha periods
     * - Dasha balance
     *
     * Therefore do not duplicate those provider requests.
     *
     * Phase-1 core upstream requests:
     * 1. Advanced Kundli
     * 2. D1
     * 3. D9
     * 4. Planet positions
     * 5. Panchang
     * 6. Ashtakavarga
     */
    const timezoneHours = Number(providerParams.timezone ?? 0);

    const transitDate = new Date(Date.now() + timezoneHours * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const transitParams: AstroParams = {
      ...providerParams,
      dob: transitDate,
      tob: '12:00:00',
    };

    const tasks: Array<() => Promise<unknown>> = [
      () => this.prokerala.getAdvancedKundli(providerParams),
      () => this.prokerala.getBirthChart(providerParams),
      () => this.prokerala.getNavamsaChart(providerParams),
      () => this.prokerala.getPlanetPositions(providerParams),
      () =>
        this.prokerala.getDivisionalPlanetPositions(providerParams, 'lagna'),
      () => this.prokerala.getPanchang(providerParams),
      () => this.prokerala.getAshtakvarga(providerParams),
      () => this.prokerala.getSadeSati(providerParams),
      () => this.prokerala.getPlanetPositions(transitParams),
    ];

    const settledResults: PromiseSettledResult<unknown>[] = [];

    for (let index = 0; index < tasks.length; index += 1) {
      if (index > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 13_000));
      }

      try {
        const value = await tasks[index]();

        settledResults.push({
          status: 'fulfilled',
          value,
        });
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);

        this.logger.warn(
          `kundli.prokerala.task.failed index=${index} task=${
            [
              'advancedKundli',
              'birthChart',
              'navamsaChart',
              'planetPositions',
              'divisionalPlanetPositions',
              'panchang',
              'ashtakavarga',
              'sadeSati',
              'transitPlanetPositions',
            ][index] ?? 'unknown'
          } message=${message}`,
        );

        settledResults.push({
          status: 'rejected',
          reason,
        });
      }
    }

    const [
      advancedKundliResult,
      birthChartResult,
      navamsaChartResult,
      planetPositionsResult,
      divisionalPlanetPositionsResult,
      panchangResult,
      ashtakavargaResult,
    ] = settledResults;

    const advancedKundli = this.valueOf('advancedKundli', advancedKundliResult);

    const advancedData = this.unwrap(advancedKundli);

    /*
     * Preserve raw real provider payload.
     */
    const kundli = advancedKundli;

    const birthChart = this.normalizeChart(
      this.valueOf('D1', birthChartResult),
      'D1',
      'Rasi Chart (D1)',
    );

    const navamsaChart = this.normalizeChart(
      this.valueOf('D9', navamsaChartResult),
      'D9',
      'Navamsa Chart (D9)',
    );

    const normalizedPlanetaryPositions = this.normalizePlanetaryPositions(
      this.valueOf('planetaryPositions', planetPositionsResult),
    );

    const planetaryPositions = this.applyDivisionalHouses(
      normalizedPlanetaryPositions,
      this.valueOf(
        'divisionalPlanetPositions',
        divisionalPlanetPositionsResult,
      ),
    );

    const panchang = this.normalizePanchang(
      this.valueOf('panchang', panchangResult),
    );

    /*
     * Verified live /kundli/advanced fields:
     * dasha_periods, dasha_balance, yoga_details, mangal_dosha.
     */
    const dasha = this.normalizeDasha(advancedKundli);

    const yogas = Array.isArray(advancedData.yoga_details)
      ? advancedData.yoga_details
      : null;

    const ashtakavarga = this.valueOf('ashtakavarga', ashtakavargaResult);

    const mangal = advancedData.mangal_dosha ?? null;

    /*
     * These are optional/advanced sections.
     * Do not spend additional provider credits during core generation.
     */
    const kaalSarp = null;
    const sadeSatiResult = settledResults[7];
    const transitPlanetPositionsResult = settledResults[8];

    const sadeSatiResponse =
      sadeSatiResult?.status === 'fulfilled'
        ? this.valueOf('sadeSati', sadeSatiResult)
        : null;

    const sadeSatiData = this.unwrap(sadeSatiResponse);

    const sadeSati =
      Object.keys(sadeSatiData).length > 0
        ? {
            is_in_sade_sati:
              typeof sadeSatiData.is_in_sade_sati === 'boolean'
                ? sadeSatiData.is_in_sade_sati
                : null,

            transit_phase:
              typeof sadeSatiData.transit_phase === 'string'
                ? sadeSatiData.transit_phase
                : null,

            description:
              typeof sadeSatiData.description === 'string'
                ? sadeSatiData.description
                : null,

            transits: Array.isArray(sadeSatiData.transits)
              ? sadeSatiData.transits
              : [],

            raw: sadeSatiData,
          }
        : null;

    const transitPlanetaryPositions =
      transitPlanetPositionsResult?.status === 'fulfilled'
        ? this.normalizePlanetaryPositions(
            this.valueOf(
              'transitPlanetaryPositions',
              transitPlanetPositionsResult,
            ),
          )
        : [];

    const transit = {
      date: transitDate,
      timezone: timezoneHours,
      planets: transitPlanetaryPositions,
    };

    /*
     * Advanced Vargas remain part of the response contract,
     * but are not fetched during Phase-1 customer generation.
     */
    const divisionalCharts = {
      D2: null,
      D3: null,
      D7: null,
      D10: null,
      D12: null,
      D60: null,
    };

    /*
     * Do NOT pretend unsupported/unverified calculations exist.
     *
     * Shadbala remains null until its real Prokerala-backed source
     * is verified. Professional validation will therefore fail closed
     * rather than saving a fake "complete" report.
     */
    const shadbala = null;

    const coreSections = {
      birthChart,
      navamsaChart,
      planetaryPositions:
        planetaryPositions.length >= 9 ? planetaryPositions : null,
      dasha: dasha.timeline && dasha.timeline.length > 0 ? dasha : null,
      panchang,
      yogas,
      ashtakavarga,
      mangal,
    };

    const totalCoreSections = Object.keys(coreSections).length;

    const availableCoreSections = Object.values(coreSections).filter(
      (value) => value !== null && value !== undefined,
    ).length;

    const corePercent = Math.round(
      (availableCoreSections / totalCoreSections) * 100,
    );

    const complete = availableCoreSections === totalCoreSections;

    const report: KundliReport = {
      provider: 'prokerala',
      language: lang,

      status: complete ? 'COMPLETE' : 'PARTIAL',

      generatedAt: new Date().toISOString(),

      completeness: {
        corePercent,
        availableCoreSections,
        totalCoreSections,
      },

      input: {
        dob: params.dob,
        tob: params.tob,
        latitude: params.lat,
        longitude: params.lon,
        timezone: params.timezone,
        language: lang,
      },

      charts: {
        birthChart,
        navamsaChart,
        divisionalCharts,
      },

      birthChart,
      navamsaChart,

      planetaryPositions,

      /*
       * Houses and Ascendant are deliberately NOT inferred
       * from planet.position.
       */
      houses: null,
      ascendant: null,

      dasha,

      yogas,
      panchang,

      shadbala,
      ashtakavarga,

      dosha: {
        mangal,
        manglik: mangal,
        kaalSarp,
        pitra: null,
        papaSamaya: null,
      },

      extended: {
        gemSuggestion: null,
        sadeSati,
        friendship: null,
      },

      kp: {
        houses: null,
        planets: null,
      },

      transit,
      analysis: {},

      metadata: {
        calculationProvider: 'prokerala',
        interpretationProvider: 'openai',
        calculationMode: 'vedic',
        ayanamsa: 'lahiri',
      },

      /*
       * Preserve raw Kundli response for later verified mappings.
       * Do not expose credentials/tokens here.
       */
      providerPayload: {
        kundli,
      },
    };

    this.logger.log(
      `kundli.generate.completed provider=prokerala status=${report.status} completeness=${corePercent}%`,
    );

    return report;
  }
}
