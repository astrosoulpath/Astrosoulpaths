import { randomUUID } from 'crypto';
import type { Express } from 'express';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Gender } from '@prisma/client';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AstroService } from '../astro/astro.service';
import { KundliPdfService } from '../kundli/kundli-pdf.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { AiAstrologerAvatarService } from './ai-astrologer-avatar.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly astroService: AstroService,
    private readonly kundliPdfService: KundliPdfService,
    private readonly aiAstrologerAvatarService: AiAstrologerAvatarService,
  ) {}

  // Resolve profiles for the authenticated Supabase user.

  /**
   * @param supabaseId Supabase JWT sub claim
   */

  private async resolveActiveLanguage(
    language?: string,
    useDatabaseDefault = false,
  ): Promise<string | undefined> {
    const normalized = language?.trim().toLowerCase();

    if (!normalized) {
      if (!useDatabaseDefault) {
        return undefined;
      }

      const defaultLanguage = await this.prisma.appLanguage.findFirst({
        where: {
          isActive: true,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            englishName: 'asc',
          },
        ],
        select: {
          code: true,
        },
      });

      if (!defaultLanguage) {
        throw new BadRequestException(
          'No active application language is configured',
        );
      }

      return defaultLanguage.code;
    }

    const activeLanguage = await this.prisma.appLanguage.findUnique({
      where: {
        code: normalized,
      },
      select: {
        code: true,
        isActive: true,
      },
    });

    if (!activeLanguage || !activeLanguage.isActive) {
      throw new BadRequestException(
        'Selected language is not available',
      );
    }

    return activeLanguage.code;
  }

  async create(supabaseId: string, dto: CreateProfileDto) {
    const selectedLanguage =
      await this.resolveActiveLanguage(dto.lang, true);

    // Resolve internal DB user id from the Supabase identity
    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: await this.findUserIdBySupabaseId(supabaseId),
      },
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
        lang: selectedLanguage,
        maritalStatus: dto.maritalStatus ?? null,
        occupation: dto.occupation ?? null,
        avatarUrl: dto.avatarUrl ?? null,
      },
    });

    return {
      success: true,
      message: 'Profile created successfully',
      data: profile,
    };
  }

  // Resolve profiles for the authenticated Supabase user.

  /**
   * @param supabaseId Supabase JWT sub claim
   */
  async findAll(supabaseId: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: await this.findUserIdBySupabaseId(supabaseId),
      },
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
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    /*
     * Canonical identity resolution
     * -----------------------------
     * A single ASP user may have multiple Supabase identities
     * such as phone OTP and Google.
     *
     * UserAuthIdentity is authoritative.
     * User.supabaseId remains the legacy fallback.
     */
    const identity = await this.prisma.userAuthIdentity.findUnique({
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

    if (identity) {
      return identity.userId;
    }

    const legacyUser = await this.prisma.user.findUnique({
      where: {
        supabaseId: normalizedSupabaseId,
      },
      select: {
        id: true,
      },
    });

    if (!legacyUser) {
      throw new BadRequestException('User not found');
    }

    return legacyUser.id;
  }
  async getPreferences(supabaseId: string) {
    const userId = await this.findUserIdBySupabaseId(supabaseId);

    const preferences = await this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        chartStyle: 'NORTH_INDIAN',
        monthType: 'AMANT',
        darkMode: false,
        hideOuterPlanets: false,
        customCalendar: false,
      },
    });

    return {
      success: true,
      message: 'Preferences fetched successfully',
      data: preferences,
    };
  }

  async updatePreferences(supabaseId: string, dto: UpdatePreferencesDto) {
    const userId = await this.findUserIdBySupabaseId(supabaseId);

    const data = {
      ...(dto.chartStyle !== undefined && {
        chartStyle: dto.chartStyle,
      }),
      ...(dto.monthType !== undefined && {
        monthType: dto.monthType,
      }),
      ...(dto.darkMode !== undefined && {
        darkMode: dto.darkMode,
      }),
      ...(dto.hideOuterPlanets !== undefined && {
        hideOuterPlanets: dto.hideOuterPlanets,
      }),
      ...(dto.customCalendar !== undefined && {
        customCalendar: dto.customCalendar,
      }),
    };

    const preferences = await this.prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        chartStyle: dto.chartStyle ?? 'NORTH_INDIAN',
        monthType: dto.monthType ?? 'AMANT',
        darkMode: dto.darkMode ?? false,
        hideOuterPlanets: dto.hideOuterPlanets ?? false,
        customCalendar: dto.customCalendar ?? false,
      },
    });

    return {
      success: true,
      message: 'Preferences updated successfully',
      data: preferences,
    };
  }

  // Resolve profiles for the authenticated Supabase user.

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

  // Resolve profiles for the authenticated Supabase user.

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

  // Resolve profiles for the authenticated Supabase user.

  async generateAstro(
    supabaseId: string,
    profileId: string,
    overrideLang?: string,
  ) {
    const profile = await this.findOwnedProfile(supabaseId, profileId);

    if (profile.timezone == null) {
      throw new NotFoundException(
        'Profile is missing timezone; cannot generate astro data',
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

  // Resolve profiles for the authenticated Supabase user.
  async update(supabaseId: string, profileId: string, dto: UpdateProfileDto) {
    if (dto.lang !== undefined) {
      dto.lang = await this.resolveActiveLanguage(dto.lang);
    }
    await this.findOwnedProfile(supabaseId, profileId);

    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.dob !== undefined) data.birthDate = new Date(dto.dob);
    if (dto.tob !== undefined) data.birthTime = dto.tob;
    if (dto.lat !== undefined) data.lat = dto.lat;
    if (dto.lon !== undefined) data.lon = dto.lon;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.timezoneName !== undefined) data.timezoneName = dto.timezoneName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.fullname !== undefined) data.fullname = dto.fullname;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.countryCode !== undefined) data.countryCode = dto.countryCode;
    if (dto.lang !== undefined) data.lang = dto.lang;
    if (dto.maritalStatus !== undefined) data.maritalStatus = dto.maritalStatus;
    if (dto.occupation !== undefined) data.occupation = dto.occupation;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    const updated = await this.prisma.profile.update({
      where: {
        id: profileId,
      },
      data,
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    };
  }

  async generateAstroPdf(
    supabaseId: string,
    profileId: string,
    requestedLang?: string,
  ): Promise<Buffer> {
    const profile = await this.findOwnedProfile(supabaseId, profileId);

    if (
      !profile.birthDate ||
      !profile.birthTime ||
      profile.lat == null ||
      profile.lon == null ||
      profile.timezone == null
    ) {
      throw new BadRequestException(
        'Complete birth date, birth time and birth location are required to generate Kundli PDF',
      );
    }

    const lang =
      requestedLang?.trim().toLowerCase() ||
      profile.lang?.trim().toLowerCase() ||
      'en';

    const params = {
      dob: profile.birthDate.toISOString().split('T')[0],
      tob: profile.birthTime,
      lat: profile.lat,
      lon: profile.lon,
      timezone: profile.timezone,
      lang,
    };

    const astro = await this.astroService.generateAstro(params, lang);

    const kundliId = astro.kundliId?.toString().trim();

    if (!kundliId) {
      throw new InternalServerErrorException(
        'Generated Kundli ID is unavailable',
      );
    }

    const report =
      astro.data && typeof astro.data === 'object' ? astro.data : null;

    if (!report) {
      throw new InternalServerErrorException(
        'Generated Kundli report is unavailable',
      );
    }

    const name = profile.fullname?.trim() || profile.name?.trim() || 'Customer';

    const birthPlace = [profile.city, profile.state, profile.country]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(', ');

    return this.kundliPdfService.generateProfileKundliPdf({
      profileId,
      kundliId,
      name,
      gender: profile.gender?.toString() ?? 'UNKNOWN',
      birthPlace,
      dob: params.dob,
      tob: params.tob,
      latitude: params.lat,
      longitude: params.lon,
      timezone: params.timezone,
      lang,
      report,
    });
  }
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

  async uploadAvatar(supabaseId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Profile image is required');
    }

    const rawMimeType = file.mimetype?.trim().toLowerCase() ?? '';
    const originalName = file.originalname?.trim().toLowerCase() ?? '';

    const extensionFromName = originalName.includes('.')
      ? originalName.substring(originalName.lastIndexOf('.') + 1)
      : '';

    const normalizedMimeType =
      rawMimeType === 'image/jpg'
        ? 'image/jpeg'
        : rawMimeType;

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    const allowedExtensions = new Set([
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);

    const mimeAllowed = allowedMimeTypes.has(normalizedMimeType);
    const extensionAllowed = allowedExtensions.has(extensionFromName);

    if (!mimeAllowed && !extensionAllowed) {
      throw new BadRequestException(
        'Only JPEG, PNG or WEBP profile images are allowed',
      );
    }

    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Profile image must be 5 MB or smaller');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const effectiveMimeType =
      normalizedMimeType && allowedMimeTypes.has(normalizedMimeType)
        ? normalizedMimeType
        : extensionFromName === 'png'
          ? 'image/png'
          : extensionFromName === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

    const extension =
      effectiveMimeType === 'image/png'
        ? 'png'
        : effectiveMimeType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const bucket = 'profile-avatars';

    const storagePath = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`;
    const client = this.supabaseService.getStorageClient();

    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(storagePath, file.buffer, {
        contentType: effectiveMimeType,
        upsert: false,
      });
    if (uploadError) {
      throw new InternalServerErrorException(
        `Unable to upload profile image: ${uploadError.message}`,
      );
    }

    const { data: publicData } = client.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const avatarUrl = publicData?.publicUrl?.trim();
    if (!avatarUrl) {
      await client.storage.from(bucket).remove([storagePath]);

      throw new InternalServerErrorException(
        'Unable to generate profile image URL',
      );
    }
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        avatarUrl,
      },
    });
    /*
     * Real profile photo is already safely persisted.
     *
     * For astrologer accounts only, automatically create a
     * premium Ask AI avatar from the same real photo.
     *
     * This operation is intentionally non-blocking from the
     * user's perspective: the avatar upload remains successful
     * even if OpenAI generation fails.
     */
    try {
      await this.aiAstrologerAvatarService.generateForUser({
        userId: user.id,
        buffer: file.buffer,
        mimeType: file.mimetype,
      });
    } catch (error) {
      this.logger.warn(
        `AI astrologer avatar generation skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    await this.removePreviousAvatarFromStorage(user.avatarUrl, avatarUrl);
    return {
      success: true,
      message: 'Profile image updated successfully',
      data: {
        avatarUrl,
      },
    };
  }

  async removeAvatar(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId,
      },
      select: {
        id: true,
        avatarUrl: true,
      },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        avatarUrl: null,
      },
    });

    await this.removePreviousAvatarFromStorage(user.avatarUrl, null);

    return {
      success: true,
      message: 'Profile image removed successfully',
      data: {
        avatarUrl: null,
      },
    };
  }

  private async removePreviousAvatarFromStorage(
    currentAvatarUrl: string | null,
    newAvatarUrl: string | null,
  ) {
    const normalizedCurrent = currentAvatarUrl?.trim();

    if (!normalizedCurrent || normalizedCurrent === newAvatarUrl) {
      return;
    }

    const marker = '/storage/v1/object/public/profile-avatars/';

    const markerIndex = normalizedCurrent.indexOf(marker);

    if (markerIndex < 0) {
      return;
    }

    const storagePath = decodeURIComponent(
      normalizedCurrent.substring(markerIndex + marker.length),
    );

    if (!storagePath) {
      return;
    }

    try {
      await this.supabaseService
        .getStorageClient()
        .storage.from('profile-avatars')
        .remove([storagePath]);
    } catch {
      // DB avatar update/remove must not fail if old storage cleanup fails.
    }
  }
}

