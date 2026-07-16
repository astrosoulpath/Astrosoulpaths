import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AstrologerEarningStatus } from '@prisma/client';

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
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async findAstrologerBySupabaseId(
    supabaseId: string,
  ) {
    const normalizedSupabaseId =
      supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId:
            normalizedSupabaseId,
        },
        select: {
          id: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User account not found',
      );
    }

    const astrologer =
      await this.prisma.astrologer.findUnique({
        where: {
          userId: user.id,
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

    if (!astrologer) {
      throw new NotFoundException(
        'Astrologer profile not found',
      );
    }

    return astrologer;
  }

  async register(
    supabaseId: string,
    dto: RegisterAstrologerDto,
  ) {
    const normalizedSupabaseId =
      supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId:
            normalizedSupabaseId,
        },
        select: {
          id: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User account not found',
      );
    }

    const existing =
      await this.prisma.astrologer.findUnique({
        where: {
          userId: user.id,
        },
      });

    if (existing) {
      throw new BadRequestException(
        'Astrologer profile already exists',
      );
    }

    const expertiseNames =
      dto.expertise
        .map((name) =>
          name.trim(),
        )
        .filter(Boolean);

    const expertiseRecords =
      await Promise.all(
        expertiseNames.map(
          (name) =>
            this.prisma.expertise.upsert({
              where: {
                name,
              },
              update: {},
              create: {
                name,
              },
            }),
        ),
      );

    const astrologer =
      await this.prisma.astrologer.create({
        data: {
          userId:
            user.id,

          Gender:
            dto.gender ?? null,

          bio:
            dto.bio?.trim() ||
            null,

          languages:
            dto.languages
              .map((language) =>
                language.trim(),
              )
              .filter(Boolean),

          experience:
            dto.experienceYears,

          pricePerMin:
            dto.consultationPrice,

          isApproved:
            false,

          isVerified:
            false,

          isOnline:
            false,

          expertise: {
            create:
              expertiseRecords.map(
                (expertise) => ({
                  expertiseId:
                    expertise.id,
                }),
              ),
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
    const search =
      filters.search?.trim();

    const language =
      filters.language?.trim();

    const expertise =
      filters.expertise?.trim();

    const astrologers =
      await this.prisma.astrologer.findMany({
        where: {
          isApproved: true,
          isVerified: true,

          ...(typeof filters.online ===
          'boolean'
            ? {
                isOnline:
                  filters.online,
              }
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
                        contains:
                          expertise,
                        mode:
                          'insensitive',
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
                        contains:
                          search,
                        mode:
                          'insensitive',
                      },
                    },
                  },
                  {
                    bio: {
                      contains:
                        search,
                      mode:
                        'insensitive',
                    },
                  },
                  {
                    expertise: {
                      some: {
                        expertise: {
                          name: {
                            contains:
                              search,
                            mode:
                              'insensitive',
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
            isOnline:
              'desc',
          },
          {
            rating:
              'desc',
          },
          {
            createdAt:
              'desc',
          },
        ],

        take: 100,
      });

    return {
      success: true,

      data:
        astrologers.map(
          (astrologer) => ({
            id:
              astrologer.id,

            /**
             * Important:
             * Socket recipient ke liye
             * related User.id.
             */
            userId:
              astrologer.user.id,

            name:
              astrologer.user.name?.trim() ||
              'Astro Soul Path Astrologer',

            avatarUrl:
              astrologer.user
                .avatarUrl ?? null,

            bio:
              astrologer.bio,

            gender:
              astrologer.Gender,

            languages:
              astrologer.languages,

            experience:
              astrologer.experience ??
              0,

            pricePerMin:
              Number(
                astrologer.pricePerMin ??
                  0,
              ),

            rating:
              Number(
                astrologer.rating ??
                  0,
              ),

            isOnline:
              astrologer.isOnline,

            expertise:
              astrologer.expertise.map(
                (item) =>
                  item.expertise.name,
              ),
          }),
        ),

      meta: {
        total:
          astrologers.length,
      },
    };
  }

  async getPublicAstrologerById(
    id: string,
  ) {
    const normalizedId =
      id?.trim();

    if (!normalizedId) {
      throw new BadRequestException(
        'Astrologer ID is required',
      );
    }

    const astrologer =
      await this.prisma.astrologer.findFirst({
        where: {
          id:
            normalizedId,

          isApproved:
            true,

          isVerified:
            true,
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
        id:
          astrologer.id,

        /**
         * Important:
         * Website aur mobile app incoming
         * call isi User.id par bhejenge.
         */
        userId:
          astrologer.user.id,

        name:
          astrologer.user.name?.trim() ||
          'Astro Soul Path Astrologer',

        avatarUrl:
          astrologer.user
            .avatarUrl ?? null,

        bio:
          astrologer.bio,

        gender:
          astrologer.Gender,

        languages:
          astrologer.languages,

        experience:
          astrologer.experience ??
          0,

        pricePerMin:
          Number(
            astrologer.pricePerMin ??
              0,
          ),

        rating:
          Number(
            astrologer.rating ??
              0,
          ),

        isOnline:
          astrologer.isOnline,

        expertise:
          astrologer.expertise.map(
            (item) =>
              item.expertise.name,
          ),

        availability:
          astrologer.isOnline
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

  async getDashboard(
    supabaseId: string,
  ) {
    const astrologer =
      await this.findAstrologerBySupabaseId(
        supabaseId,
      );

    const profileChecks = [
      Boolean(astrologer.bio),
      astrologer.languages.length >
        0,
      astrologer.expertise.length >
        0,
      astrologer.pricePerMin !==
        null,
      Boolean(
        astrologer.documents,
      ),
      astrologer.isApproved &&
        astrologer.isVerified,
    ];

    const completed =
      profileChecks.filter(
        Boolean,
      ).length;

    const profileCompletion =
      Math.round(
        (completed /
          profileChecks.length) *
          100,
      );

    const startOfToday =
      new Date();

    startOfToday.setHours(
      0,
      0,
      0,
      0,
    );

    const [
      availableEarnings,
      todayCalls,
      todayChats,
    ] =
      await this.prisma.$transaction([
        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status:
              AstrologerEarningStatus.AVAILABLE,
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.callSession.count({
          where: {
            astrologerId:
              astrologer.user.id,

            endedAt: {
              gte:
                startOfToday,
            },
          },
        }),

        this.prisma.callSession.count({
          where: {
            astrologerId:
              astrologer.user.id,

            messages: {
              some: {
                createdAt: {
                  gte:
                    startOfToday,
                },
              },
            },
          },
        }),
      ]);

    return {
      success: true,

      data: {
        astrologerId:
          astrologer.id,

        /**
         * Dashboard/client socket
         * registration ke liye useful.
         */
        userId:
          astrologer.user.id,

        name:
          astrologer.user.name?.trim() ||
          'Astro Soul Path Astrologer',

        avatarUrl:
          astrologer.user
            .avatarUrl ?? null,

        earnings:
          Number(
            availableEarnings
              ._sum
              .netAmount ??
              0,
          ),

        todayCalls,

        todayChats,

        rating:
          Number(
            astrologer.rating ??
              0,
          ),

        isOnline:
          astrologer.isOnline,

        isApproved:
          astrologer.isApproved,

        isVerified:
          astrologer.isVerified,

        profileCompletion,

        pendingConsultations:
          0,

        todaySchedule: [],

        languages:
          astrologer.languages,

        expertise:
          astrologer.expertise.map(
            (item) =>
              item.expertise.name,
          ),

        pricePerMin:
          Number(
            astrologer.pricePerMin ??
              0,
          ),

        experience:
          astrologer.experience ??
          0,
      },
    };
  }

  async getEarningsSummary(
    supabaseId: string,
  ) {
    const astrologer =
      await this.findAstrologerBySupabaseId(
        supabaseId,
      );

    const now =
      new Date();

    const startOfToday =
      new Date(now);

    startOfToday.setHours(
      0,
      0,
      0,
      0,
    );

    const startOfWeek =
      new Date(startOfToday);

    const currentDay =
      startOfWeek.getDay();

    const daysFromMonday =
      currentDay === 0
        ? 6
        : currentDay - 1;

    startOfWeek.setDate(
      startOfWeek.getDate() -
        daysFromMonday,
    );

    const startOfMonth =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );

    const activeStatuses = [
      AstrologerEarningStatus.AVAILABLE,
      AstrologerEarningStatus.PAID,
    ];

    const [
      availableResult,
      pendingResult,
      paidResult,
      todayResult,
      weekResult,
      monthResult,
      lifetimeResult,
      totalTransactions,
    ] =
      await this.prisma.$transaction([
        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status:
              AstrologerEarningStatus.AVAILABLE,
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status:
              AstrologerEarningStatus.PENDING,
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status:
              AstrologerEarningStatus.PAID,
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status: {
              in:
                activeStatuses,
            },

            createdAt: {
              gte:
                startOfToday,
            },
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status: {
              in:
                activeStatuses,
            },

            createdAt: {
              gte:
                startOfWeek,
            },
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status: {
              in:
                activeStatuses,
            },

            createdAt: {
              gte:
                startOfMonth,
            },
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId:
              astrologer.id,

            status: {
              in:
                activeStatuses,
            },
          },

          _sum: {
            netAmount:
              true,
          },
        }),

        this.prisma.astrologerEarning.count({
          where: {
            astrologerId:
              astrologer.id,
          },
        }),
      ]);

    return {
      success: true,

      data: {
        astrologerId:
          astrologer.id,

        currency:
          'INR',

        availableBalance:
          Number(
            availableResult
              ._sum
              .netAmount ??
              0,
          ),

        pendingBalance:
          Number(
            pendingResult
              ._sum
              .netAmount ??
              0,
          ),

        paidAmount:
          Number(
            paidResult
              ._sum
              .netAmount ??
              0,
          ),

        todayEarnings:
          Number(
            todayResult
              ._sum
              .netAmount ??
              0,
          ),

        weekEarnings:
          Number(
            weekResult
              ._sum
              .netAmount ??
              0,
          ),

        monthEarnings:
          Number(
            monthResult
              ._sum
              .netAmount ??
              0,
          ),

        lifetimeEarnings:
          Number(
            lifetimeResult
              ._sum
              .netAmount ??
              0,
          ),

        totalTransactions,
      },
    };
  }

  async getEarningsTransactions(
    supabaseId: string,
  ) {
    const astrologer =
      await this.findAstrologerBySupabaseId(
        supabaseId,
      );

    const earnings =
      await this.prisma.astrologerEarning.findMany({
        where: {
          astrologerId:
            astrologer.id,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take:
          100,

        include: {
          callSession: {
            select: {
              id: true,
              userId: true,
              channelName: true,
              ratePerMinute: true,
              purchasedMinutes: true,
              extendedMinutes: true,
              amountCharged: true,
              startedAt: true,
              endedAt: true,
              status: true,

              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

    return {
      success: true,

      data: {
        transactions:
          earnings.map(
            (earning) => ({
              id:
                earning.id,

              callSessionId:
                earning.callSessionId,

              type:
                'earning',

              title:
                'Consultation Earnings',

              grossAmount:
                Number(
                  earning
                    .grossAmount,
                ),

              platformFee:
                Number(
                  earning
                    .platformFee,
                ),

              netAmount:
                Number(
                  earning
                    .netAmount,
                ),

              currency:
                earning.currency,

              status:
                earning.status,

              availableAt:
                earning.availableAt,

              paidAt:
                earning.paidAt,

              reversedAt:
                earning.reversedAt,

              createdAt:
                earning.createdAt,

              consultation: {
                id:
                  earning
                    .callSession
                    .id,

                customerId:
                  earning
                    .callSession
                    .userId,

                customerName:
                  earning
                    .callSession
                    .user
                    .name ??
                  'Astro Soul Path User',

                customerAvatarUrl:
                  earning
                    .callSession
                    .user
                    .avatarUrl ??
                  null,

                channelName:
                  earning
                    .callSession
                    .channelName,

                ratePerMinute:
                  Number(
                    earning
                      .callSession
                      .ratePerMinute,
                  ),

                purchasedMinutes:
                  earning
                    .callSession
                    .purchasedMinutes,

                extendedMinutes:
                  earning
                    .callSession
                    .extendedMinutes,

                amountCharged:
                  Number(
                    earning
                      .callSession
                      .amountCharged,
                  ),

                startedAt:
                  earning
                    .callSession
                    .startedAt,

                endedAt:
                  earning
                    .callSession
                    .endedAt,

                status:
                  earning
                    .callSession
                    .status,
              },
            }),
          ),

        total:
          earnings.length,
      },
    };
  }

  async updateStatus(
    supabaseId: string,
    isOnline: boolean,
  ) {
    if (
      typeof isOnline !==
      'boolean'
    ) {
      throw new BadRequestException(
        'isOnline must be a boolean value',
      );
    }

    const astrologer =
      await this.findAstrologerBySupabaseId(
        supabaseId,
      );

    if (
      !astrologer.isApproved ||
      !astrologer.isVerified
    ) {
      throw new BadRequestException(
        'Only approved and verified astrologers can go online',
      );
    }

    const updated =
      await this.prisma.astrologer.update({
        where: {
          id:
            astrologer.id,
        },
        data: {
          isOnline,
        },
      });

    return {
      success: true,

      message:
        isOnline
          ? 'Astrologer is now online'
          : 'Astrologer is now offline',

      data: {
        astrologerId:
          updated.id,

        userId:
          astrologer.user.id,

        isOnline:
          updated.isOnline,
      },
    };
  }
}