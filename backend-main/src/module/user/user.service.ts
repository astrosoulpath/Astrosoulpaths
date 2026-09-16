import { BadRequestException } from '@nestjs/common';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Gender, Prisma } from '@prisma/client';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const authUserInclude = Prisma.validator<Prisma.UserInclude>()({
  role: true,
  subscriptionPlan: true,
  astrologer: true,
  userProfile: true,
});

type UserProfileCompletionShape = {
  fullName: string | null;
  dateOfBirth: Date | null;
  timeOfBirth: string | null;
  birthTimeKnown: boolean;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: number | null;
  gender: Gender | null;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves a Supabase auth UUID to the canonical ASP User.
   *
   * Explicit UserAuthIdentity mapping wins.
   * Legacy User.supabaseId remains the fallback for accounts
   * which have not yet been backfilled.
   *
   * Always returns authUserInclude so callers retain the exact
   * relation shape they previously received.
   */
  private async resolveUserBySupabaseId(supabaseId: string) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      return null;
    }

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
      return this.prisma.user.findUnique({
        where: {
          id: identity.userId,
        },
        include: authUserInclude,
      });
    }

    return this.prisma.user.findUnique({
      where: {
        supabaseId: normalizedSupabaseId,
      },
      include: authUserInclude,
    });
  }

  async getUserWithRelations(supabaseId: string) {
    return this.resolveUserBySupabaseId(supabaseId);
  }
  private async resolveCanonicalUserId(
    supabaseId: string,
  ): Promise<string | null> {
    const user = await this.resolveUserBySupabaseId(supabaseId);
    return user?.id ?? null;
  }

  /**
   * Store and compare phone identities in one canonical E.164-like form.
   * Supabase may return the verified phone without the leading "+".
   */
  private normalizePhoneIdentity(phone?: string | null): string | null {
    const raw = phone?.trim();

    if (!raw) {
      return null;
    }

    const digits = raw.replace(/\D/g, '');

    if (!digits) {
      return null;
    }

    return `+${digits}`;
  }

  async getUserWithRelationsByPhone(phone: string) {
    const normalizedPhone = this.normalizePhoneIdentity(phone);

    if (!normalizedPhone) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: {
        phone: normalizedPhone,
      },
      include: authUserInclude,
    });
  }
  private isUserProfileComplete(profile: UserProfileCompletionShape | null) {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.fullName &&
      profile.dateOfBirth &&
      (profile.birthTimeKnown === false || profile.timeOfBirth) &&
      profile.city &&
      profile.countryCode &&
      profile.latitude != null &&
      profile.longitude != null &&
      profile.timezone != null &&
      profile.gender,
    );
  }

  private getUserNextStep(isProfileComplete: boolean) {
    return isProfileComplete ? 'OPEN_HOME' : 'COMPLETE_PROFILE';
  }

  private normalizeLocationData(dto: any) {
    const location =
      typeof dto.location === 'string' ? dto.location.trim() : '';

    if (!location) {
      return {};
    }

    const parts = location
      .split(',')
      .map((x: string) => x.trim())
      .filter(Boolean);

    const country =
      typeof dto.country === 'string' && dto.country.trim()
        ? dto.country.trim()
        : (parts[2] ?? null);

    const explicitCountryCode =
      typeof dto.countryCode === 'string' && dto.countryCode.trim()
        ? dto.countryCode.trim().toUpperCase()
        : null;

    const isIndia =
      country?.trim().toLowerCase() === 'india' ||
      parts.some((part: string) => part.trim().toLowerCase() === 'india');

    return {
      city: dto.city ?? parts[0] ?? null,
      state: dto.state ?? parts[1] ?? null,
      country,
      countryCode: explicitCountryCode ?? (isIndia ? 'IN' : null),
      timezoneName: dto.timezoneName ?? (isIndia ? 'Asia/Kolkata' : null),
    };
  }

  private buildCreateUserProfileData(dto: CreateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth:
        dto.birthTimeKnown === false ? null : dto.timeOfBirth,
      birthTimeKnown: dto.birthTimeKnown ?? true,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      timezoneName: dto.timezoneName,
      ...this.normalizeLocationData(dto),
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
      lang: dto.lang,
    };
  }

  private buildUpdateUserProfileData(dto: UpdateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth:
        dto.birthTimeKnown === false ? null : dto.timeOfBirth,
      birthTimeKnown: dto.birthTimeKnown ?? true,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      timezoneName: dto.timezoneName,
      ...this.normalizeLocationData(dto),
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
      lang: dto.lang,
    };
  }

  async syncUser(data: {
    supabaseId: string;
    phone?: string | null;
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  }) {
    try {
      const supabaseId = data.supabaseId?.trim();
      const phone = this.normalizePhoneIdentity(data.phone);
      const email = data.email?.trim().toLowerCase() || null;
      const fullName = data.fullName?.trim() || null;

      if (!supabaseId) {
        throw new InternalServerErrorException('Supabase user ID is required');
      }

      const role = await this.prisma.role.findUnique({
        where: { name: 'user' },
      });

      if (!role) {
        throw new InternalServerErrorException('Default role not found');
      }

      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { name: 'FREE' },
      });

      if (!freePlan) {
        throw new InternalServerErrorException(
          'Default FREE subscription plan not found',
        );
      }

      // 1. Strongest identity:
      // explicit auth mapping first, legacy User.supabaseId second.
      let existingUser = await this.resolveUserBySupabaseId(supabaseId);

      // 2. Account linking:
      // Google/Supabase can return a new auth identity for an email that
      // already belongs to an ASP customer. Reuse that customer instead
      // of creating a duplicate database account.
      if (!existingUser && email) {
        existingUser = await this.prisma.user.findUnique({
          where: { email },
          include: authUserInclude,
        });
      }

      // 3. Phone is another unique verified identity used by OTP login.
      if (!existingUser && phone) {
        existingUser = await this.prisma.user.findUnique({
          where: { phone },
          include: authUserInclude,
        });
      }

      let user: Prisma.UserGetPayload<{
        include: typeof authUserInclude;
      }>;

      let isNewUser = false;

      if (existingUser) {
        // Only an explicit provider mapping may bridge a temporary
        // legacy duplicate. Email/name matching alone never links users.
        const mappedIdentity = await this.prisma.userAuthIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: 'supabase',
              providerUserId: supabaseId,
            },
          },
          select: {
            userId: true,
          },
        });

        const isExplicitlyMapped = mappedIdentity?.userId === existingUser.id;

        // Preserve collision protection for every unlinked account.
        if (email && !isExplicitlyMapped) {
          const emailOwner = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });

          if (emailOwner && emailOwner.id !== existingUser.id) {
            throw new ConflictException(
              'This email address belongs to another account',
            );
          }
        }

        if (phone && !isExplicitlyMapped) {
          const phoneOwner = await this.prisma.user.findUnique({
            where: { phone },
            select: { id: true },
          });

          if (phoneOwner && phoneOwner.id !== existingUser.id) {
            throw new ConflictException(
              'This phone number belongs to another account',
            );
          }
        }

        const supabaseOwner = await this.prisma.user.findUnique({
          where: { supabaseId },
          select: { id: true },
        });

        if (
          supabaseOwner &&
          supabaseOwner.id !== existingUser.id &&
          !isExplicitlyMapped
        ) {
          throw new ConflictException(
            'This authentication account is already linked to another user',
          );
        }

        const isProfileComplete = this.isUserProfileComplete(
          existingUser.userProfile,
        );

        user = await this.prisma.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            // Preserve the canonical/primary Supabase UUID.
            // Secondary UUIDs live in UserAuthIdentity.
            ...(phone && !existingUser.phone ? { phone } : {}),

            // Do not claim an email still owned by a temporary legacy
            // duplicate. It will be moved only during verified FK merge.
            ...(email && !existingUser.email && !isExplicitlyMapped
              ? { email }
              : {}),

            ...(fullName && !existingUser.name ? { name: fullName } : {}),
            isProfileComplete,
          },
          include: authUserInclude,
        });

        this.logger.log(`User account linked/synced successfully: ${user.id}`);
      } else {
        isNewUser = true;

        user = await this.prisma.user.create({
          data: {
            supabaseId,
            phone,
            email,
            name: fullName,
            roleId: role.id,
            isProfileComplete: false,
            freeChatGrantedAt: new Date(),
            freeChatUsedAt: null,
            freeChatMinutes: 1,
            subscriptionPlanId: freePlan.id,
            subscriptionStatus: 'FREE',
          },
          include: authUserInclude,
        });

        this.logger.log(
          `New customer account created successfully: ${user.id}`,
        );
      }

      return {
        user,
        isNewUser,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : String(error.meta?.target ?? 'email or phone');

        this.logger.warn(
          `User sync conflict for Supabase ID ${data.supabaseId}. Target: ${target}`,
        );

        throw new ConflictException(
          'An account already exists with this email address or phone number',
        );
      }

      if (
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `User sync failed for Supabase ID ${data.supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to sync user account');
    }
  }
  async findBySupabaseId(supabaseId: string) {
    const user = await this.resolveUserBySupabaseId(supabaseId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async ensureAstrologerProfileBySupabaseId(supabaseId: string) {
    const user = await this.findBySupabaseId(supabaseId);

    if (!user.isAstrologer || user.astrologer) {
      return user;
    }

    this.logger.log(
      `Creating astrologer profile for user ${user.id} (${user.supabaseId})`,
    );

    await this.prisma.astrologer.create({
      data: {
        userId: user.id,
        languages: [],
      },
    });

    return this.findBySupabaseId(supabaseId);
  }

  async getProfile(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id:
          (await this.resolveCanonicalUserId(supabaseId)) ??
          '__canonical_user_not_found__',
      },
      select: {
        isProfileComplete: true,
        userProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: user.userProfile,
      isProfileComplete: user.isProfileComplete,
      nextStep: this.getUserNextStep(user.isProfileComplete),
    };
  }

  private async validateProfileLanguage(
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
      throw new BadRequestException('Selected language is not available');
    }

    return activeLanguage.code;
  }

  async createProfile(supabaseId: string, dto: CreateUserProfileDto) {
    dto.lang = await this.validateProfileLanguage(dto.lang, true);

    const user = await this.prisma.user.findUnique({
      where: {
        id:
          (await this.resolveCanonicalUserId(supabaseId)) ??
          '__canonical_user_not_found__',
      },
      select: {
        id: true,
        userProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.userProfile) {
      throw new ConflictException('User profile already exists');
    }

    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const createdProfile = await tx.userProfile.create({
          data: {
            userId: user.id,
            ...this.buildCreateUserProfileData(dto),
          },
        });

        const isProfileComplete = this.isUserProfileComplete(createdProfile);

        await tx.user.update({
          where: { id: user.id },
          data: { isProfileComplete },
        });

        return createdProfile;
      });

      const isProfileComplete = this.isUserProfileComplete(profile);

      return {
        success: true,
        message: 'User profile created successfully',
        data: profile,
        isProfileComplete,
        nextStep: this.getUserNextStep(isProfileComplete),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A unique user profile field already exists',
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create profile for Supabase ID ${supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to create user profile');
    }
  }

  async updateProfile(supabaseId: string, dto: UpdateUserProfileDto) {
    if (dto.lang !== undefined) {
      dto.lang = await this.validateProfileLanguage(dto.lang);
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id:
          (await this.resolveCanonicalUserId(supabaseId)) ??
          '__canonical_user_not_found__',
      },
      select: {
        id: true,
        userProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.userProfile) {
      throw new NotFoundException('User profile not found');
    }

    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const updatedProfile = await tx.userProfile.update({
          where: { userId: user.id },
          data: this.buildUpdateUserProfileData(dto),
        });

        const isProfileComplete = this.isUserProfileComplete(updatedProfile);

        await tx.user.update({
          where: { id: user.id },
          data: { isProfileComplete },
        });

        return updatedProfile;
      });

      const isProfileComplete = this.isUserProfileComplete(profile);

      return {
        success: true,
        message: 'User profile updated successfully',
        data: profile,
        isProfileComplete,
        nextStep: this.getUserNextStep(isProfileComplete),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A unique user profile field already exists',
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to update profile for Supabase ID ${supabaseId}: ${message}`,
      );

      throw new InternalServerErrorException('Failed to update user profile');
    }
  }

  async findAll(page = 1, limit = 10) {
    try {
      return await this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          role: true,
          subscriptionPlan: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch users: ${message}`);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        subscriptionPlan: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(
    id: string,
    data: {
      phone?: string;
      fullName?: string;
      gender?: Gender;
      birthDate?: Date;
      birthTime?: string;
      birthPlace?: string;
      profileImage?: string;
      isProfileComplete?: boolean;
    },
  ) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update user ${id}: ${message}`);

      throw new InternalServerErrorException('Failed to update user profile');
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete user ${id}: ${message}`);

      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}




