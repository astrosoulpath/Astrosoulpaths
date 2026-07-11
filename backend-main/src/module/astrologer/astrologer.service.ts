import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';

type PublicAstrologerFilters = {
  search?: string;
  language?: string;
  expertise?: string;
  online?: boolean;
};

@Injectable()
export class AstrologerService {
  constructor(private readonly prisma: PrismaService) {}

  private async findAstrologerBySupabaseId(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const astrologer = await this.prisma.astrologer.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    if (!astrologer) {
      throw new NotFoundException('Astrologer profile not found');
    }

    return astrologer;
  }

  async register(supabaseId: string, dto: RegisterAstrologerDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const existing = await this.prisma.astrologer.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      throw new BadRequestException(
        'Astrologer profile already exists',
      );
    }

    const expertiseRecords = await Promise.all(
      dto.expertise.map((name) =>
        this.prisma.expertise.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    const astrologer = await this.prisma.astrologer.create({
      data: {
        userId: user.id,
        Gender: dto.gender ?? null,
        bio: dto.bio ?? null,
        languages: dto.languages,
        experience: dto.experienceYears,
        pricePerMin: dto.consultationPrice,
        isApproved: false,
        isVerified: false,
        isOnline: false,
        expertise: {
          create: expertiseRecords.map((expertise) => ({
            expertiseId: expertise.id,
          })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    return {
      success: true,
      message:
        'Astrologer registration submitted for admin approval',
      data: astrologer,
    };
  }

  async getPublicAstrologers(
    filters: PublicAstrologerFilters = {},
  ) {
    const search = filters.search?.trim();
    const language = filters.language?.trim();
    const expertise = filters.expertise?.trim();

    const astrologers = await this.prisma.astrologer.findMany({
      where: {
        isApproved: true,
        isVerified: true,

        ...(typeof filters.online === 'boolean'
          ? { isOnline: filters.online }
          : {}),

        ...(language
          ? {
              languages: {
                has: language,
              },
            }
          : {}),

        ...(expertise
          ? {
              expertise: {
                some: {
                  expertise: {
                    name: {
                      contains: expertise,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            }
          : {}),

        ...(search
          ? {
              OR: [
                {
                  user: {
                    name: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
                {
                  bio: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  expertise: {
                    some: {
                      expertise: {
                        name: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },

      orderBy: [
        {
          isOnline: 'desc',
        },
        {
          rating: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],

      take: 100,
    });

    return {
      success: true,
      data: astrologers.map((astrologer) => ({
        id: astrologer.id,

        name:
          astrologer.user.name?.trim() ||
          'Astro Soul Path Astrologer',

        avatarUrl: astrologer.user.avatarUrl ?? null,
        bio: astrologer.bio,
        gender: astrologer.Gender,
        languages: astrologer.languages,
        experience: astrologer.experience ?? 0,
        pricePerMin: astrologer.pricePerMin ?? 0,
        rating: astrologer.rating ?? 0,
        isOnline: astrologer.isOnline,

        expertise: astrologer.expertise.map(
          (item) => item.expertise.name,
        ),
      })),

      meta: {
        total: astrologers.length,
      },
    };
  }

  async getPublicAstrologerById(id: string) {
    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id,
        isApproved: true,
        isVerified: true,
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        expertise: {
          include: {
            expertise: true,
          },
        },
      },
    });

    if (!astrologer) {
      throw new NotFoundException(
        'Approved astrologer profile not found',
      );
    }

    return {
      success: true,
      data: {
        id: astrologer.id,

        name:
          astrologer.user.name?.trim() ||
          'Astro Soul Path Astrologer',

        avatarUrl: astrologer.user.avatarUrl ?? null,
        bio: astrologer.bio,
        gender: astrologer.Gender,
        languages: astrologer.languages,
        experience: astrologer.experience ?? 0,
        pricePerMin: astrologer.pricePerMin ?? 0,
        rating: astrologer.rating ?? 0,
        isOnline: astrologer.isOnline,

        expertise: astrologer.expertise.map(
          (item) => item.expertise.name,
        ),

        availability: astrologer.isOnline
          ? 'Available for consultation'
          : 'Currently offline',

        consultationOptions: {
          chat: true,
          audioCall: true,
          videoCall: false,
        },
      },
    };
  }

  async getDashboard(supabaseId: string) {
    const astrologer =
      await this.findAstrologerBySupabaseId(supabaseId);

    const profileChecks = [
      Boolean(astrologer.bio),
      astrologer.languages.length > 0,
      astrologer.expertise.length > 0,
      astrologer.pricePerMin !== null,
      Boolean(astrologer.documents),
      astrologer.isApproved && astrologer.isVerified,
    ];

    const completed = profileChecks.filter(Boolean).length;

    const profileCompletion = Math.round(
      (completed / profileChecks.length) * 100,
    );

    return {
      success: true,
      data: {
        astrologerId: astrologer.id,
        name:
          astrologer.user.name?.trim() ||
          'Astro Soul Path Astrologer',
        avatarUrl: astrologer.user.avatarUrl ?? null,
        earnings: 0,
        todayCalls: 0,
        todayChats: 0,
        rating: astrologer.rating ?? 0,
        isOnline: astrologer.isOnline,
        isApproved: astrologer.isApproved,
        isVerified: astrologer.isVerified,
        profileCompletion,
        pendingConsultations: 0,
        todaySchedule: [],
        languages: astrologer.languages,
        expertise: astrologer.expertise.map(
          (item) => item.expertise.name,
        ),
        pricePerMin: astrologer.pricePerMin ?? 0,
        experience: astrologer.experience ?? 0,
      },
    };
  }

  async updateStatus(
    supabaseId: string,
    isOnline: boolean,
  ) {
    if (typeof isOnline !== 'boolean') {
      throw new BadRequestException(
        'isOnline must be a boolean value',
      );
    }

    const astrologer =
      await this.findAstrologerBySupabaseId(supabaseId);

    if (!astrologer.isApproved || !astrologer.isVerified) {
      throw new BadRequestException(
        'Only approved and verified astrologers can go online',
      );
    }

    const updated = await this.prisma.astrologer.update({
      where: { id: astrologer.id },
      data: { isOnline },
    });

    return {
      success: true,
      message: isOnline
        ? 'Astrologer is now online'
        : 'Astrologer is now offline',
      data: {
        astrologerId: updated.id,
        isOnline: updated.isOnline,
      },
    };
  }
}