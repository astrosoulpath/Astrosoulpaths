import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Gender } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AstroService } from '../astro/astro.service';
import { CreateProfileDto } from './dto/create-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly astroService: AstroService,
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────

  /**
   * @param supabaseId — JWT `sub` claim (Supabase user ID)
   */
  async create(supabaseId: string, dto: CreateProfileDto) {
    // Resolve internal DB user id from the Supabase identity
    const dbUser = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!dbUser) {
      throw new NotFoundException('User account not found');
    }

    const profile = await this.prisma.profile.create({
      data: {
        userId: dbUser.id,
        name: dto.name,
        gender: dto.gender ?? Gender.OTHER,
        birthDate: new Date(dto.dob),
        birthTime: dto.tob,
        lat: dto.lat,
        lon: dto.lon,
        timezone: dto.timezone,
        timezoneName: dto.timezoneName ?? null,
        fullname: dto.fullname ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        country: dto.country ?? null,
        countryCode: dto.countryCode ?? null,
        lang: dto.lang ?? 'en',
      },
    });

    return {
      success: true,
      message: 'Profile created successfully',
      data: profile,
    };
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  /**
   * @param supabaseId — JWT `sub` claim
   */
  async findAll(supabaseId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!dbUser) {
      throw new NotFoundException('User account not found');
    }

    const profiles = await this.prisma.profile.findMany({
      where: { userId: dbUser.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Profiles fetched successfully',
      data: profiles,
    };
  }

  private async findUserIdBySupabaseId(supabaseId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!dbUser) {
      throw new NotFoundException('User account not found');
    }

    return dbUser.id;
  }

  // ─── Internal helper ──────────────────────────────────────────────────────

  async findOne(id: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id } });

    if (!profile || profile.isDeleted) {
      throw new NotFoundException('Profile not found');
    }

    return profile;
  }

  private async findOwnedProfile(supabaseId: string, profileId: string) {
    const userId = await this.findUserIdBySupabaseId(supabaseId);
    const profile = await this.findOne(profileId);

    if (profile.userId !== userId) {
      throw new ForbiddenException(
        'Profile does not belong to the current user',
      );
    }

    return profile;
  }

  // ─── Get by ID ────────────────────────────────────────────────────────────

  async getProfileById(id: string) {
    const profile = await this.findOne(id);

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: profile,
    };
  }

  async getOwnedProfileById(supabaseId: string, id: string) {
    const profile = await this.findOwnedProfile(supabaseId, id);

    return {
      success: true,
      message: 'Profile fetched successfully',
      data: profile,
    };
  }

  // ─── Generate Astro ───────────────────────────────────────────────────────

  async generateAstro(
    supabaseId: string,
    profileId: string,
    overrideLang?: string,
  ) {
    const profile = await this.findOwnedProfile(supabaseId, profileId);

    if (profile.timezone == null) {
      throw new NotFoundException(
        'Profile is missing timezone — cannot generate astro data',
      );
    }

    const lang = overrideLang ?? profile.lang ?? 'en';

    const params = {
      dob: profile.birthDate.toISOString().split('T')[0],
      tob: profile.birthTime,
      lat: profile.lat,
      lon: profile.lon,
      timezone: profile.timezone,
      lang,
    };

    this.logger.log(`Generating astro for profileId=${profileId} lang=${lang}`);

    try {
      const astro = await this.astroService.generateAstro(params, lang);

      return {
        success: true,
        message: 'Astro generated successfully',
        data: astro,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Astro generation failed',
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Failed to generate astro data');
    }
  }

  // ─── Soft delete ──────────────────────────────────────────────────────────

  async delete(supabaseId: string, profileId: string) {
    await this.findOwnedProfile(supabaseId, profileId);

    const deleted = await this.prisma.profile.update({
      where: { id: profileId },
      data: { isDeleted: true },
    });

    return {
      success: true,
      message: 'Profile deleted successfully',
      data: deleted,
    };
  }
}
