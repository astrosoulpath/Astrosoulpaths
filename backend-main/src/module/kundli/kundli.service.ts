import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { AstroParams } from '../../common/types/astro-params.type';
import { generateKundliHash } from '../../common/utlis/hash.util';

import { KundliAiService } from './kundli-ai.service';
import { KundliRepository } from './kundli.repository';
import type { IKundliProvider } from './providers/interfaces/kundli-provider.interface';

import { validateProfessionalKundliReport } from './professional-kundli-report.validator';
@Injectable()
export class KundliService {
  private readonly logger = new Logger(KundliService.name);

  constructor(
    private readonly repo: KundliRepository,
    private readonly kundliAiService: KundliAiService,
    private readonly prisma: PrismaService,
    @Inject('KUNDLI_PROVIDER')
    private readonly kundliProvider: IKundliProvider,
  ) {}

  async findByParams(params: AstroParams) {
    const hash = generateKundliHash(params);

    return this.repo.findByHash(hash);
  }

  private mapToKundliData(params: AstroParams, hash: string) {
    return {
      dob: params.dob,
      tob: params.tob,
      latitude: params.lat,
      longitude: params.lon,
      timezone: params.timezone,
      hash,
    };
  }

  private isCompleteVedicReport(data: unknown): boolean {
    return validateProfessionalKundliReport(data).valid;
  }

  /**
   * Legacy-cache migration check.
   * A Prokerala report generated before D1 house integration
   * must be recalculated once if displayed planetary houses are missing.
   */
  private hasValidSadeSati(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;

    const extended =
      report.extended &&
      typeof report.extended === 'object' &&
      !Array.isArray(report.extended)
        ? (report.extended as Record<string, any>)
        : {};

    const sadeSati = extended.sadeSati ?? report.sadeSati ?? report.sade_sati;

    if (!sadeSati || typeof sadeSati !== 'object' || Array.isArray(sadeSati)) {
      return false;
    }

    const row = sadeSati as Record<string, any>;

    return (
      typeof row.is_in_sade_sati === 'boolean' &&
      'transit_phase' in row &&
      'description' in row
    );
  }
  private hasValidGemSuggestion(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;
    const gem = report.extended?.gemSuggestion;

    if (!gem || typeof gem !== 'object' || Array.isArray(gem)) {
      return false;
    }

    return (
      typeof gem.gemstone === 'string' &&
      gem.gemstone.trim().length > 0 &&
      typeof gem.planet === 'string' &&
      gem.planet.trim().length > 0 &&
      typeof gem.ascendantSign === 'string' &&
      Number.isInteger(gem.ascendantSignNo) &&
      gem.ascendantSignNo >= 1 &&
      gem.ascendantSignNo <= 12 &&
      gem.calculation === 'lagna-lord-primary-gemstone'
    );
  }
  private hasValidTransit(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;
    const transit = report.transit;

    if (!transit || typeof transit !== 'object' || Array.isArray(transit)) {
      return false;
    }

    const planets = Array.isArray(transit.planets)
      ? transit.planets
      : [];

    const requiredPlanets = [
      'Sun',
      'Moon',
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
      'Rahu',
      'Ketu',
    ];

    return (
      transit.calculation === 'local-astronomy-engine-lahiri-transit' &&
      typeof transit.calculatedAt === 'string' &&
      planets.length === 9 &&
      requiredPlanets.every((name) =>
        planets.some(
          (planet: any) =>
            planet?.name === name &&
            Number.isFinite(planet?.longitude),
        ),
      )
    );
  }
  private hasValidImportantYogas(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;

    const groups = Array.isArray(report.yogas)
      ? report.yogas
      : Array.isArray(report.yoga_details)
        ? report.yoga_details
        : [];

    if (groups.length === 0) {
      return false;
    }

    let validProviderItems = 0;

    for (const rawGroup of groups) {
      if (
        !rawGroup ||
        typeof rawGroup !== 'object' ||
        Array.isArray(rawGroup)
      ) {
        continue;
      }

      const group = rawGroup as Record<string, any>;

      const yogaList = Array.isArray(group.yoga_list)
        ? group.yoga_list
        : Array.isArray(group.yogaList)
          ? group.yogaList
          : [];

      for (const rawYoga of yogaList) {
        if (!rawYoga || typeof rawYoga !== 'object' || Array.isArray(rawYoga)) {
          continue;
        }

        const yoga = rawYoga as Record<string, any>;

        const name = typeof yoga.name === 'string' ? yoga.name.trim() : '';

        const hasYogaState =
          typeof yoga.has_yoga === 'boolean' ||
          typeof yoga.hasYoga === 'boolean';

        if (name.length > 0 && hasYogaState) {
          validProviderItems += 1;
        }
      }
    }

    return validProviderItems > 0;
  }
  private hasValidPlanetaryNakshatras(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;

    const positions = Array.isArray(report.planetaryPositions)
      ? report.planetaryPositions
      : [];

    if (positions.length < 9) {
      return false;
    }

    const normalizeName = (planet: Record<string, any>): string => {
      const value =
        planet?.name ??
        planet?.full_name ??
        planet?.fullName ??
        planet?.vedic_name ??
        planet?.vedicName ??
        '';

      return String(value).trim().toLowerCase();
    };

    const hasNakshatra = (planet: Record<string, any>): boolean => {
      const value =
        planet?.nakshatra ?? planet?.nakshatra_name ?? planet?.nakshatraName;

      return typeof value === 'string' && value.trim().length > 0;
    };

    const required: string[][] = [
      ['sun'],
      ['moon'],
      ['mercury'],
      ['venus'],
      ['mars'],
      ['jupiter'],
      ['saturn'],
      ['rahu'],
      ['ketu'],
    ];

    return required.every((aliases) => {
      const planet = positions.find((item: Record<string, any>) =>
        aliases.includes(normalizeName(item)),
      );

      return !!planet && hasNakshatra(planet);
    });
  }
  private hasValidPlanetaryHouses(data: unknown): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return false;
    }

    const report = data as Record<string, any>;

    const positions = Array.isArray(report.planetaryPositions)
      ? report.planetaryPositions
      : [];

    if (positions.length < 9) {
      return false;
    }

    const normalizeName = (planet: Record<string, any>): string => {
      const value =
        planet?.name ??
        planet?.full_name ??
        planet?.fullName ??
        planet?.vedic_name ??
        planet?.vedicName ??
        '';

      return String(value).trim().toLowerCase();
    };

    const validHouse = (planet: Record<string, any>): boolean => {
      const value =
        planet?.house ?? planet?.houseNumber ?? planet?.house_number;

      const house = Number(value);

      return Number.isInteger(house) && house >= 1 && house <= 12;
    };

    const required: string[][] = [
      ['sun'],
      ['moon'],
      ['mercury'],
      ['venus'],
      ['mars'],
      ['jupiter'],
      ['saturn'],
      ['rahu'],
      ['ketu'],
    ];

    const coreValid = required.every((aliases) => {
      const planet = positions.find((item: Record<string, any>) =>
        aliases.includes(normalizeName(item)),
      );

      return !!planet && validHouse(planet);
    });

    if (!coreValid) {
      return false;
    }

    const ascendant = positions.find((item: Record<string, any>) => {
      const name = normalizeName(item);
      return name === 'ascendant' || name === 'lagna';
    });

    // If Ascendant is part of this report, it must also contain
    // the real provider house. We do not manufacture House 1 locally.
    return !ascendant || validHouse(ascendant);
  }

  async getOrCreateKundli(params: AstroParams) {
    const hash = generateKundliHash(params);

    let kundli = await this.repo.findByHash(hash);

    if (!kundli) {
      this.logger.log(`kundli.create hash=${hash}`);

      kundli = await this.repo.createKundli(this.mapToKundliData(params, hash));
    }

    return kundli;
  }

  async findKundliData(params: AstroParams, lang: string) {
    const kundli = await this.getOrCreateKundli(params);

    if (!kundli?.id) {
      this.logger.error('Kundli not found during cache lookup');

      throw new NotFoundException('Kundli not found');
    }

    return this.repo.findKundliData(kundli.id, lang);
  }

  async saveKundliData(params: AstroParams, data: any, lang: string) {
    const kundli = await this.getOrCreateKundli(params);

    if (!kundli?.id) {
      this.logger.error('Kundli ID missing during save');

      throw new NotFoundException('Kundli ID not found');
    }

    this.logger.log(`kundli.cache.save kundliId=${kundli.id} lang=${lang}`);

    return this.repo.saveKundliData(kundli.id, lang, data);
  }

  async generateMyKundli(supabaseUserId: string, lang = 'en') {
    const normalizedSupabaseId = supabaseUserId?.trim();

    if (!normalizedSupabaseId) {
      throw new ForbiddenException('Authenticated customer is required');
    }

    /*


     * Canonical customer identity resolution.


     *


     * UserAuthIdentity is authoritative so Phone OTP, Google,


     * and any other linked Supabase identity resolve to the same User.


     * User.supabaseId is kept as a legacy fallback.


     * Internal User.id is supported for local/dev authentication.


     */

    const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',

          providerUserId: normalizedSupabaseId,
        },
      },

      select: {
        userId: true,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(mappedIdentity?.userId ? [{ id: mappedIdentity.userId }] : []),

          { supabaseId: normalizedSupabaseId },

          { id: normalizedSupabaseId },
        ],
      },

      select: {
        id: true,
        isActive: true,
        isBlocked: true,
        isAstrologer: true,
        userProfile: {
          select: {
            id: true,
            fullName: true,
            gender: true,
            dateOfBirth: true,
            timeOfBirth: true,
            latitude: true,
            longitude: true,
            timezone: true,
            city: true,
            state: true,
            country: true,
          },
        },
        UserPreference: {
          select: {
            chartStyle: true,
            monthType: true,
            darkMode: true,
            hideOuterPlanets: true,
            customCalendar: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Customer account not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException('Customer account is inactive or blocked');
    }

    const profile = user.userProfile;

    const preferences = user.UserPreference ?? {
      chartStyle: 'NORTH_INDIAN',
      monthType: 'AMANT',
      darkMode: false,
      hideOuterPlanets: false,
      customCalendar: false,
    };

    if (!profile) {
      throw new BadRequestException({
        code: 'BIRTH_PROFILE_INCOMPLETE',
        message: 'Complete your birth profile to generate your Kundli',
      });
    }

    const fullName = profile.fullName?.trim();
    const birthDate = profile.dateOfBirth;
    const timeOfBirth = profile.timeOfBirth?.trim();

    if (
      !fullName ||
      !birthDate ||
      !timeOfBirth ||
      profile.latitude == null ||
      profile.longitude == null ||
      profile.timezone == null
    ) {
      throw new BadRequestException({
        code: 'BIRTH_PROFILE_INCOMPLETE',
        message:
          'Name, birth date, birth time and complete birth location are required',
      });
    }

    const normalizedLang = lang?.trim().toLowerCase() || 'en';

    const params: AstroParams = {
      dob: birthDate.toISOString().split('T')[0],
      tob: timeOfBirth,
      lat: profile.latitude,
      lon: profile.longitude,
      timezone: profile.timezone,
      lang: normalizedLang,
      name: fullName,
      gender: profile.gender.toLowerCase() as 'male' | 'female' | 'other',
      place: [profile.city, profile.state, profile.country]
        .filter(Boolean)
        .join(', '),
      userId: user.id,
    };

    const generated = await this.generateReport(params, normalizedLang);

    return {
      userId: user.id,
      profile: {
        profileId: profile.id,
        name: fullName,
        gender: profile.gender,
        birthPlace: params.place,
        dob: params.dob,
        tob: params.tob,
        lat: params.lat,
        lon: params.lon,
        timezone: params.timezone,
      },
      kundli: generated.kundli,
      report: generated.report,
      source: generated.source,
      preferences: {
        chartStyle: preferences.chartStyle,
        monthType: preferences.monthType,
        darkMode: preferences.darkMode,
        hideOuterPlanets: preferences.hideOuterPlanets,
        customCalendar: preferences.customCalendar,
      },
    };
  }
  async generateReport(
    params: AstroParams,
    lang = 'en',
    options?: {
      forceRefresh?: boolean;
    },
  ) {
    const kundli = await this.getOrCreateKundli(params);

    const cached = await this.repo.findKundliData(kundli.id, lang);

    /*
     * Cache is trusted only when the same professional validator
     * confirms the required D1/D9 core calculation.
     */
    const cachedReport = cached?.vedic as any;

    /*
     * Customer AI Kundli uses the self-hosted Local Vedic engine as the factual source.
     * Never serve a historical external-provider calculation as the current
     * production Kundli merely because it passes completeness validation.
     */
    const isCurrentLocalVedicCache =
      cachedReport?.provider === 'local-vedic' &&
      this.isCompleteVedicReport(cachedReport) &&
      this.hasValidPlanetaryHouses(cachedReport) &&
      this.hasValidPlanetaryNakshatras(cachedReport) &&
      this.hasValidImportantYogas(cachedReport) &&
      this.hasValidSadeSati(cachedReport) &&
      this.hasValidTransit(cachedReport) &&
      this.hasValidGemSuggestion(cachedReport);

    if (!options?.forceRefresh && isCurrentLocalVedicCache) {
      this.logger.log(`kundli.cache.hit kundliId=${kundli.id} lang=${lang}`);

      const report = cached?.vedic as any;

      /*
       * AI interpretation is enrichment only.
       * It never replaces astrology calculations.
       */
      const needsAiAnalysis =
        !report.analysis?.character ||
        !report.analysis?.d1Explanation ||
        !report.analysis?.d9Explanation;

      if (needsAiAnalysis) {
        try {
          const aiAnalysis =
            await this.kundliAiService.generateAnalysis(report);

          report.analysis = {
            ...(report.analysis ?? {}),
            ...aiAnalysis,
          };

          await this.repo.saveKundliData(kundli.id, lang, {
            vedic: report,
          });

          this.logger.log(
            `kundli.ai.cache.enriched kundliId=${kundli.id} lang=${lang}`,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown AI error';

          this.logger.warn(
            `kundli.ai.cache.unavailable kundliId=${kundli.id} lang=${lang} message=${message}`,
          );
        }
      }

      return {
        kundli,
        report,
        source: 'cache' as const,
      };
    }

    this.logger.log(`kundli.cache.miss kundliId=${kundli.id} lang=${lang}`);

    /*
     * CALCULATION SOURCE
     *
     * Real Vedic provider calculation happens first.
     */
    const report = await this.kundliProvider.generate(params, lang);

    /*
     * Strict professional validation.
     *
     * Required Phase-1:
     * - D1 Birth Chart
     * - D9 Navamsa
     * - planets
     * - Dasha
     * - Panchang
     * - Yoga/Dosha
     * - Shadbala
     * - Ashtakavarga
     */
    const providerValidation = validateProfessionalKundliReport(report);

    if (!providerValidation.valid) {
      this.logger.error(
        `kundli.provider.incomplete kundliId=${kundli.id} lang=${lang} missing=${providerValidation.missingSections.join(',')}`,
      );

      throw new BadGatewayException({
        success: false,
        code: 'KUNDLI_REQUIRED_DATA_INCOMPLETE',
        message:
          'Professional Kundli calculation is incomplete. Please try again when the astrology calculation service is available.',
        missingSections: providerValidation.missingSections,
        advancedMissingSections: providerValidation.advancedMissingSections,
        completenessPercent: providerValidation.corePercent,
      });
    }

    /*
     * CRITICAL:
     *
     * Save verified calculation BEFORE AI.
     *
     * If OpenAI/AI interpretation fails, the real paid astrology
     * calculation stays in DB and does not require another
     * provider API call.
     */
    await this.repo.saveKundliData(kundli.id, lang, {
      vedic: report,
    });

    this.logger.log(
      `kundli.provider.calculation.preserved kundliId=${kundli.id} lang=${lang}`,
    );

    /*
     * AI is interpretation only.
     * Never fabricate missing astrology values.
     */
    try {
      const aiAnalysis = await this.kundliAiService.generateAnalysis(report);

      report.analysis = {
        ...(report.analysis ?? {}),
        ...aiAnalysis,
      };

      await this.repo.saveKundliData(kundli.id, lang, {
        vedic: report,
      });

      this.logger.log(
        `kundli.ai.provider.enriched kundliId=${kundli.id} lang=${lang}`,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown AI error';

      this.logger.warn(
        `kundli.ai.provider.unavailable kundliId=${kundli.id} lang=${lang} message=${message}`,
      );
    }

    if (providerValidation.advancedMissingSections.length > 0) {
      this.logger.warn(
        `kundli.advanced_vargas.partial kundliId=${kundli.id} missing=${providerValidation.advancedMissingSections.join(',')}`,
      );
    }

    this.logger.log(
      `kundli.generation.completed kundliId=${kundli.id} lang=${lang}`,
    );

    return {
      kundli,
      report,
      source: 'provider' as const,
    };
  }

  async askMyKundliCategory(
    supabaseUserId: string,
    category: string,
    question: string,
    lang = 'en',
  ) {
    /*
     * Reuse the exact same authenticated customer Kundli pipeline.
     * No client supplied DOB / time / latitude / longitude is trusted here.
     */
    const result = await this.generateMyKundli(supabaseUserId, lang);

    const aiResponse = await this.kundliAiService.generateCategoryAnswer(
      result.report,
      category,
      question,
    );

    return {
      ...aiResponse,
      kundliId: result.kundli.id,
      source: 'LOCAL_VEDIC_KUNDLI',
    };
  }
}


