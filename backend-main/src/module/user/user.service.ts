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
  latitude: number | null;
  longitude: number | null;
  timezone: number | null;
  gender: Gender | null;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  private isUserProfileComplete(profile: UserProfileCompletionShape | null) {
    if (!profile) {
      return false;
    }

    return Boolean(
      profile.fullName &&
      profile.dateOfBirth &&
      profile.timeOfBirth &&
      profile.latitude != null &&
      profile.longitude != null &&
      profile.timezone != null &&
      profile.gender,
    );
  }

  private getUserNextStep(isProfileComplete: boolean) {
    return isProfileComplete ? 'OPEN_HOME' : 'COMPLETE_PROFILE';
  }

  private buildCreateUserProfileData(dto: CreateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth: dto.timeOfBirth,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      timezoneName: dto.timezoneName,
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
    };
  }

  private buildUpdateUserProfileData(dto: UpdateUserProfileDto) {
    return {
      fullName: dto.fullName,
      username: dto.username,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      timeOfBirth: dto.timeOfBirth,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone: dto.timezone,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      countryCode: dto.countryCode,
      timezoneName: dto.timezoneName,
      gender: dto.gender,
      location: dto.location,
      avatarUrl: dto.avatarUrl,
    };
  }

  // 🔄 Sync user from Supabase (Create or Update)
  async syncUser(data: {
    supabaseId: string;
    phone?: string | null;
    email?: string | null;
    fullName?: string | null;
  }) {
    try {
      const phone = data.phone?.trim() || null;
      const email = data.email?.trim().toLowerCase() || null;
      const fullName = data.fullName?.trim() || null;

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

      const existingUser = await this.prisma.user.findUnique({
        where: {
          supabaseId: data.supabaseId,
        },
        include: authUserInclude,
      });

      let user: Prisma.UserGetPayload<{
        include: typeof authUserInclude;
      }>;

      let isNewUser = false;

      if (existingUser) {
        const isProfileComplete = this.isUserProfileComplete(
          existingUser.userProfile,
        );

        user = await this.prisma.user.update({
          where: {
            supabaseId: data.supabaseId,
          },
          data: {
            ...(phone ? { phone } : {}),
            ...(email ? { email } : {}),
            ...(fullName ? { name: fullName } : {}),
            isProfileComplete,
          },
          include: authUserInclude,
        });
      } else {
        isNewUser = true;

        user = await this.prisma.user.create({
          data: {
            supabaseId: data.supabaseId,
            phone,
            email,
            name: fullName,
            roleId: role.id,
            isProfileComplete: false,
            subscriptionPlanId: freePlan.id,
            subscriptionStatus: 'FREE',
          },
          include: authUserInclude,
        });
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

  // 👤 Get user by Supabase ID
  async findBySupabaseId(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      include: authUserInclude,
    });

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
      where: { supabaseId },
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

  async createProfile(supabaseId: string, dto: CreateUserProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
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
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
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

  // 📄 Get all users with pagination
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

  // 🔍 Get single user by DB ID
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

  // ✏️ Update user profile
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

  // ❌ Delete user
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