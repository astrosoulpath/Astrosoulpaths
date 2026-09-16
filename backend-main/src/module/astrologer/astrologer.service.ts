import { UpsertAstrologerBankAccountDto } from './dto/astrologer-bank-account.dto';
import { AstrologerPayoutProviderService } from './astrologer-payout-provider.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AstrologerEarningStatus,
  AstrologerPayoutStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import type { Express } from 'express';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';
import { UpdateAstrologerProfileDto } from './dto/update-astrologer-profile.dto';
import { UpdateAstrologerAvailabilityDto } from './dto/update-astrologer-availability.dto';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

type PublicAstrologerFilters = {
  search?: string;
  language?: string;
  expertise?: string;
  category?: string;
  online?: boolean;
};

@Injectable()
export class AstrologerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly payoutProvider: AstrologerPayoutProviderService,
  ) {}

  async uploadKycDocument(
    supabaseId: string,
    file: Express.Multer.File | undefined,
    documentType: string,
  ) {
    const normalizedSupabaseId = supabaseId?.trim();

    const normalizedDocumentType = documentType?.trim().toLowerCase();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    if (!file) {
      throw new BadRequestException('KYC document file is required');
    }

    if (
      !['identity', 'certificate', 'experience'].includes(
        normalizedDocumentType,
      )
    ) {
      throw new BadRequestException('Invalid KYC document type');
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPG and PNG files are allowed');
    }

    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new BadRequestException('KYC document must be 10 MB or smaller');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const extensionMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
    };

    const extension = extensionMap[file.mimetype] ?? '';

    const bucket = 'astrologer-kyc';

    const storagePath = `${user.id}/${normalizedDocumentType}/${randomUUID()}${extension}`;

    const client = this.supabaseService.getStorageClient();

    try {
      const { error: uploadError } = await client.storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,

          cacheControl: '3600',

          upsert: false,
        });

      if (uploadError) {
        throw new BadRequestException(uploadError.message);
      }

      return {
        success: true,

        message: 'KYC document uploaded successfully',

        data: {
          path: storagePath,

          fileName: file.originalname,

          mimeType: file.mimetype,

          size: file.size,

          documentType: normalizedDocumentType,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Unable to upload KYC document');
    }
  }

  /**
   * Resolve the authenticated Supabase identity to the canonical ASP user.
   *
   * UserAuthIdentity is authoritative for linked/secondary auth UUIDs.
   * User.supabaseId remains the legacy fallback for accounts that have
   * not yet been backfilled into UserAuthIdentity.
   */
  private async findAstrologerBySupabaseId(supabaseId: string) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

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

    const user = mappedIdentity
      ? await this.prisma.user.findUnique({
          where: {
            id: mappedIdentity.userId,
          },
          select: {
            id: true,
          },
        })
      : await this.prisma.user.findUnique({
          where: {
            supabaseId: normalizedSupabaseId,
          },
          select: {
            id: true,
          },
        });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const astrologer = await this.prisma.astrologer.findUnique({
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
      throw new NotFoundException('Astrologer profile not found');
    }

    return astrologer;
  }

  async getOnboardingStatus(supabaseId: string) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },

      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,

        astrologer: {
          select: {
            id: true,
            isApproved: true,
            isVerified: true,
            isOnline: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const astrologer = user.astrologer;

    if (!astrologer) {
      return {
        success: true,

        data: {
          userExists: true,
          hasProfile: false,

          isApproved: false,
          isVerified: false,
          isOnline: false,

          nextStep: 'REGISTER',

          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            avatarUrl: user.avatarUrl,
          },

          astrologer: null,
        },
      };
    }

    const isReadyForDashboard = astrologer.isApproved && astrologer.isVerified;

    return {
      success: true,

      data: {
        userExists: true,
        hasProfile: true,

        isApproved: astrologer.isApproved,

        isVerified: astrologer.isVerified,

        isOnline: astrologer.isOnline,

        nextStep: isReadyForDashboard ? 'DASHBOARD' : 'PENDING_APPROVAL',

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
        },

        astrologer: {
          id: astrologer.id,
        },
      },
    };
  }

  async register(supabaseId: string, dto: RegisterAstrologerDto) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },
      select: {
        id: true,
        astrologer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (user.astrologer) {
      throw new BadRequestException('Astrologer profile already exists');
    }

    // Qualification is controlled by admin settings.
    // When enabled, registration is blocked until the applicant passes.
    const qualificationSettings =
      await this.prisma.astrologerQualificationSettings.findUnique({
        where: {
          id: 'default',
        },
      });

    const qualificationEnabled = qualificationSettings?.isEnabled ?? true;

    if (qualificationEnabled) {
      const passedQualification =
        await this.prisma.astrologerQualificationAttempt.findFirst({
          where: {
            userId: user.id,
            passed: true,
          },
          orderBy: {
            completedAt: 'desc',
          },
          select: {
            id: true,
            score: true,
            passingScore: true,
            completedAt: true,
          },
        });

      if (!passedQualification) {
        throw new BadRequestException(
          'You must pass the astrology qualification test before registration',
        );
      }
    }

    const languages = [
      ...new Set(
        dto.languages.map((language) => language.trim()).filter(Boolean),
      ),
    ];

    const expertiseNames = [
      ...new Set(dto.expertise.map((name) => name.trim()).filter(Boolean)),
    ];

    const consultationCategories = [
      ...new Set(
        (dto.consultationCategories ?? [])
            .map((category) => category.trim().toLowerCase())
            .filter(Boolean),
      ),
    ];

    if (languages.length === 0) {
      throw new BadRequestException('At least one language is required');
    }

    if (expertiseNames.length === 0) {
      throw new BadRequestException('At least one expertise is required');
    }

    const astrologer = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: dto.fullName.trim(),
          email: dto.email.trim(),
          phone: dto.phoneNumber.trim(),

          // Registration is only an application.
          // Admin approval enables astrologer access.
          isAstrologer: false,
        },
      });

      const expertiseRecords = await Promise.all(
        expertiseNames.map((name) =>
          tx.expertise.upsert({
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

      return tx.astrologer.create({
        data: {
          userId: user.id,
          Gender: dto.gender ?? null,
          bio: dto.bio?.trim() || null,
          languages,
          experience: dto.experienceYears,
          pricePerMin: dto.consultationPrice,

          documents: dto.documents
            ? ({
                ...(dto.documents.identityProof
                  ? {
                      identityProof: {
                        type: dto.documents.identityProof.type,
                        name: dto.documents.identityProof.name,
                        url: dto.documents.identityProof.url,
                      },
                    }
                  : {}),

                certificates:
                  dto.documents.certificates?.map((document) => ({
                    type: document.type,
                    name: document.name,
                    url: document.url,
                  })) ?? [],

                experienceProofs:
                  dto.documents.experienceProofs?.map((document) => ({
                    type: document.type,
                    name: document.name,
                    url: document.url,
                  })) ?? [],
              } satisfies Prisma.InputJsonObject)
            : undefined,

          isApproved: false,
          isVerified: false,
          isOnline: false,
          consultationCategories,

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
              isAstrologer: true,
            },
          },
          expertise: {
            include: {
              expertise: true,
            },
          },
        },
      });
    });

    return {
      success: true,
      message: 'Astrologer registration submitted for admin approval',
      data: astrologer,
    };
  }
  async getPublicAstrologers(filters: PublicAstrologerFilters = {}) {
    const search = filters.search?.trim();

    const language = filters.language?.trim();

    const expertise = filters.expertise?.trim();

    const category = filters.category?.trim().toLowerCase();

    const astrologers = await this.prisma.astrologer.findMany({
      where: {
        ...(category
            ? {
                consultationCategories: {
                  has: category,
                },
              }
            : {}),

        isApproved: true,
        isVerified: true,
        user: {
          is: {
            isActive: true,
            isBlocked: false,
            isAstrologer: true,
            name: {
              not: null,
            },
          },
        },

        ...(typeof filters.online === 'boolean'
          ? {
              isOnline: filters.online,
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

    const now = new Date();

    const activeConsultations = await this.prisma.callSession.findMany({
      where: {
        astrologerId: { in: astrologers.map((item) => item.user.id) },
        status: 'ACTIVE',
        endedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        astrologerId: true,
        expiresAt: true,
      },
    });

    const activeByAstrologer = new Map(
      activeConsultations.map((call) => [call.astrologerId, call]),
    );

    return {
      success: true,

      data: astrologers.map((astrologer) => {
        const activeCall = activeByAstrologer.get(astrologer.user.id);
        const chatWaitMinutes = activeCall
          ? Math.max(
              1,
              Math.ceil(
                (activeCall.expiresAt.getTime() - now.getTime()) / 60_000,
              ),
            )
          : 0;

        return {
          id: astrologer.id,

          /**
           * Important:
           * Socket recipient ke liye
           * related User.id.
           */
          userId: astrologer.user.id,

          name: astrologer.user.name?.trim() || 'Astro Soul Path Astrologer',

          avatarUrl: astrologer.user.avatarUrl ?? null,

          bio: astrologer.bio,

          gender: astrologer.Gender,

          languages: astrologer.languages,

          experience: astrologer.experience ?? 0,

          pricePerMin: Number(astrologer.pricePerMin ?? 0),

          rating: Number(astrologer.rating ?? 0),

          isOnline: astrologer.isOnline,

          consultationCategories: astrologer.consultationCategories,
          expertise: astrologer.expertise.map((item) => item.expertise.name),

          consultationOptions: {
            chat: true,
            audioCall: true,
            videoCall: true,
          },
        };
      }),

      meta: {
        total: astrologers.length,
      },
    };
  }

  async getPublicAstrologerById(id: string) {
    const normalizedId = id?.trim();

    if (!normalizedId) {
      throw new BadRequestException('Astrologer ID is required');
    }

    const astrologer = await this.prisma.astrologer.findFirst({
      where: {
        id: normalizedId,

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
      throw new NotFoundException('Approved astrologer profile not found');
    }

    return {
      success: true,

      data: {
        id: astrologer.id,

        /**
         * Important:
         * Website aur mobile app incoming
         * call isi User.id par bhejenge.
         */
        userId: astrologer.user.id,

        name: astrologer.user.name?.trim() || 'Astro Soul Path Astrologer',

        avatarUrl: astrologer.user.avatarUrl ?? null,

        bio: astrologer.bio,

        gender: astrologer.Gender,

        languages: astrologer.languages,

        experience: astrologer.experience ?? 0,

        pricePerMin: Number(astrologer.pricePerMin ?? 0),

        rating: Number(astrologer.rating ?? 0),

        isOnline: astrologer.isOnline,

        consultationCategories: astrologer.consultationCategories,
        expertise: astrologer.expertise.map((item) => item.expertise.name),

        availability: astrologer.isOnline
          ? 'Available for consultation'
          : 'Currently offline',

        consultationOptions: {
          chat: true,
          audioCall: true,
          videoCall: true,
        },
      },
    };
  }

  async getDashboard(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

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
    const [totalEarnings, todayAudioCalls, todayVideoCalls, todayChats] =
      await this.prisma.$transaction([
        this.prisma.astrologerEarning.aggregate({
          where: {
            astrologerId: astrologer.id,
            status: {
              in: [
                AstrologerEarningStatus.PENDING,
                AstrologerEarningStatus.AVAILABLE,
                AstrologerEarningStatus.PAID,
              ],
            },
          },
          _sum: {
            netAmount: true,
          },
        }),

        this.prisma.callSession.count({
          where: {
            astrologerId: astrologer.user.id,
            mode: 'audio',
          },
        }),

        this.prisma.callSession.count({
          where: {
            astrologerId: astrologer.user.id,
            mode: 'video',
          },
        }),

        this.prisma.callSession.count({
          where: {
            astrologerId: astrologer.user.id,
            mode: 'chat',
            messages: {
              some: {},
            },
          },
        }),
      ]);

    return {
      success: true,

      data: {
        astrologerId: astrologer.id,

        /**
         * Dashboard/client socket
         * registration ke liye useful.
         */
        userId: astrologer.user.id,

        name: astrologer.user.name?.trim() || 'Astro Soul Path Astrologer',

        avatarUrl: astrologer.user.avatarUrl ?? null,

        earnings: Number(totalEarnings._sum.netAmount ?? 0),

        todayCalls: todayAudioCalls,

        todayVideoCalls,
        todayChats,

        rating: Number(astrologer.rating ?? 0),

        isOnline: astrologer.isOnline,

        isApproved: astrologer.isApproved,

        isVerified: astrologer.isVerified,

        profileCompletion,

        pendingConsultations: 0,

        todaySchedule: [],

        languages: astrologer.languages,

        expertise: astrologer.expertise.map((item) => item.expertise.name),

        pricePerMin: Number(astrologer.pricePerMin ?? 0),

        experience: astrologer.experience ?? 0,
      },
    };
  }

  async getEarningsSummary(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    const now = new Date();

    const startOfToday = new Date(now);

    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);

    const currentDay = startOfWeek.getDay();

    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

    startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
    ] = await this.prisma.$transaction([
      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: AstrologerEarningStatus.AVAILABLE,
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: AstrologerEarningStatus.PENDING,
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: AstrologerEarningStatus.PAID,
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: {
            in: activeStatuses,
          },

          createdAt: {
            gte: startOfToday,
          },
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: {
            in: activeStatuses,
          },

          createdAt: {
            gte: startOfWeek,
          },
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: {
            in: activeStatuses,
          },

          createdAt: {
            gte: startOfMonth,
          },
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.aggregate({
        where: {
          astrologerId: astrologer.id,

          status: {
            in: activeStatuses,
          },
        },

        _sum: {
          netAmount: true,
        },
      }),

      this.prisma.astrologerEarning.count({
        where: {
          astrologerId: astrologer.id,
        },
      }),
    ]);

    return {
      success: true,

      data: {
        astrologerId: astrologer.id,

        currency: 'INR',

        availableBalance: Number(availableResult._sum.netAmount ?? 0),

        pendingBalance: Number(pendingResult._sum.netAmount ?? 0),

        paidAmount: Number(paidResult._sum.netAmount ?? 0),

        todayEarnings: Number(todayResult._sum.netAmount ?? 0),

        weekEarnings: Number(weekResult._sum.netAmount ?? 0),

        monthEarnings: Number(monthResult._sum.netAmount ?? 0),

        lifetimeEarnings: Number(lifetimeResult._sum.netAmount ?? 0),

        totalTransactions,
      },
    };
  }

  async getPayoutBankAccount(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        supabaseId: supabaseId.trim(),
      },
      select: {
        astrologer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user?.astrologer) {
      throw new NotFoundException('Astrologer profile not found');
    }

    const bankAccount = await this.prisma.astrologerBankAccount.findFirst({
      where: {
        astrologerId: user.astrologer.id,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: bankAccount
        ? {
            id: bankAccount.id,
            accountHolderName: bankAccount.accountHolderName,
            maskedAccountNumber: `****${bankAccount.accountNumberLast4}`,
            ifsc: bankAccount.ifsc,
            bankName: bankAccount.bankName,
            isVerified: bankAccount.isVerified,
            isActive: bankAccount.isActive,
            createdAt: bankAccount.createdAt,
            updatedAt: bankAccount.updatedAt,
          }
        : null,
    };
  }

  async savePayoutBankAccount(
    supabaseId: string,
    dto: UpsertAstrologerBankAccountDto,
  ) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        astrologer: {
          select: {
            id: true,
            isApproved: true,
            isVerified: true,
          },
        },
      },
    });

    if (!user?.astrologer) {
      throw new NotFoundException('Astrologer profile not found');
    }

    if (!user.astrologer.isApproved) {
      throw new BadRequestException(
        'Only approved astrologers can configure payouts',
      );
    }

    const accountNumber = dto.accountNumber.trim();

    const ifsc = dto.ifsc.trim().toUpperCase();

    const accountHolderName = dto.accountHolderName.trim();

    const bankName = dto.bankName?.trim() || null;

    const provider = await this.payoutProvider.createBankFundAccount({
      astrologerId: user.astrologer.id,
      name: user.name?.trim() || accountHolderName,
      email: user.email,
      phone: user.phone,
      accountHolderName,
      accountNumber,
      ifsc,
    });

    const accountNumberLast4 = accountNumber.slice(-4);

    const bankAccount = await this.prisma.$transaction(
      async (tx) => {
        await tx.astrologerBankAccount.updateMany({
          where: {
            astrologerId: user.astrologer!.id,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        return tx.astrologerBankAccount.create({
          data: {
            astrologerId: user.astrologer!.id,
            accountHolderName,
            accountNumberLast4,
            ifsc,
            bankName,
            providerContactId: provider.contactId,
            providerFundAccountId: provider.fundAccountId,
            isVerified: true,
            isActive: true,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      success: true,
      message: 'Payout bank account saved successfully',
      data: {
        id: bankAccount.id,
        accountHolderName: bankAccount.accountHolderName,
        maskedAccountNumber: `****${bankAccount.accountNumberLast4}`,
        ifsc: bankAccount.ifsc,
        bankName: bankAccount.bankName,
        isVerified: bankAccount.isVerified,
        isActive: bankAccount.isActive,
      },
    };
  }

  async getPayoutHistory(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    const payouts = await this.prisma.astrologerPayout.findMany({
      where: {
        astrologerId: astrologer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        bankAccount: {
          select: {
            id: true,
            accountHolderName: true,
            accountNumberLast4: true,
            ifsc: true,
            bankName: true,
          },
        },
      },
    });

    return {
      success: true,
      data: payouts.map((payout) => ({
        id: payout.id,
        amount: Number(payout.amount),
        currency: payout.currency,
        status: payout.status,
        providerReference: payout.providerReference,
        failureReason: payout.failureReason,
        requestedAt: payout.requestedAt,
        processedAt: payout.processedAt,
        completedAt: payout.completedAt,
        bankAccount: payout.bankAccount
          ? {
              id: payout.bankAccount.id,
              accountHolderName: payout.bankAccount.accountHolderName,
              maskedAccountNumber: `****${payout.bankAccount.accountNumberLast4}`,
              ifsc: payout.bankAccount.ifsc,
              bankName: payout.bankAccount.bankName,
            }
          : null,
      })),
    };
  }
  async requestPayout(
    supabaseId: string,
    mode: 'IMPS' | 'NEFT' | 'RTGS' = 'IMPS',
  ) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    if (!astrologer.isApproved) {
      throw new BadRequestException(
        'Only approved astrologers can withdraw earnings',
      );
    }

    const bankAccount = await this.prisma.astrologerBankAccount.findFirst({
      where: {
        astrologerId: astrologer.id,
        isActive: true,
        isVerified: true,
        providerFundAccountId: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!bankAccount || !bankAccount.providerFundAccountId) {
      throw new BadRequestException(
        'A verified payout bank account is required',
      );
    }

    /*
     * Reserve earnings before contacting RazorpayX.
     * Serializable isolation prevents concurrent withdrawals
     * from reserving the same AVAILABLE earnings.
     */
    const reserved = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.astrologerPayout.findFirst({
          where: {
            astrologerId: astrologer.id,
            status: {
              in: [
                AstrologerPayoutStatus.REQUESTED,
                AstrologerPayoutStatus.PROCESSING,
              ],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (existing) {
          throw new BadRequestException('A payout is already in progress');
        }

        const availableEarnings = await tx.astrologerEarning.findMany({
          where: {
            astrologerId: astrologer.id,
            status: AstrologerEarningStatus.AVAILABLE,
            payoutId: null,
          },
          select: {
            id: true,
            netAmount: true,
            currency: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (availableEarnings.length === 0) {
          throw new BadRequestException(
            'No available earnings are eligible for payout',
          );
        }

        const currencies = new Set(
          availableEarnings.map((earning) => earning.currency),
        );

        if (currencies.size !== 1) {
          throw new BadRequestException(
            'Available earnings contain multiple currencies',
          );
        }

        const amount = availableEarnings.reduce(
          (total, earning) => total.plus(earning.netAmount),
          new Prisma.Decimal(0),
        );

        if (amount.lte(0)) {
          throw new BadRequestException(
            'Payout amount must be greater than zero',
          );
        }

        const idempotencyKey = randomUUID();

        const payout = await tx.astrologerPayout.create({
          data: {
            astrologerId: astrologer.id,
            bankAccountId: bankAccount.id,
            amount,
            currency: availableEarnings[0].currency,
            status: AstrologerPayoutStatus.REQUESTED,
            idempotencyKey,
          },
        });

        const earningIds = availableEarnings.map((earning) => earning.id);

        const reservation = await tx.astrologerEarning.updateMany({
          where: {
            id: {
              in: earningIds,
            },
            astrologerId: astrologer.id,
            status: AstrologerEarningStatus.AVAILABLE,
            payoutId: null,
          },
          data: {
            payoutId: payout.id,
          },
        });

        if (reservation.count !== earningIds.length) {
          throw new BadRequestException(
            'Some earnings are no longer available for payout',
          );
        }

        return payout;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    const amountPaise = Math.round(Number(reserved.amount) * 100);

    try {
      const providerPayout = await this.payoutProvider.createPayout({
        payoutId: reserved.id,
        fundAccountId: bankAccount.providerFundAccountId,
        amountPaise,
        currency: reserved.currency,
        mode,
        idempotencyKey: reserved.idempotencyKey!,
      });

      const providerStatus = providerPayout.status || 'processing';

      const updated = await this.prisma.astrologerPayout.update({
        where: {
          id: reserved.id,
        },
        data: {
          providerReference: providerPayout.id,
          providerStatus,
          providerStatusDetails: providerPayout.status_details
            ? (JSON.parse(
                JSON.stringify(providerPayout.status_details),
              ) as Prisma.InputJsonValue)
            : undefined,
          status: AstrologerPayoutStatus.PROCESSING,
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Withdrawal submitted successfully',
        data: {
          id: updated.id,
          amount: Number(updated.amount),
          currency: updated.currency,
          status: updated.status,
          providerStatus: updated.providerStatus,
          requestedAt: updated.requestedAt,
          bankAccount: {
            id: bankAccount.id,
            accountHolderName: bankAccount.accountHolderName,
            maskedAccountNumber: `****${bankAccount.accountNumberLast4}`,
            bankName: bankAccount.bankName,
          },
        },
      };
    } catch (error) {
      /*
       * The idempotency key remains persisted.
       *
       * We DO NOT mark provider uncertainty as success.
       * The earnings remain reserved so a network ambiguity
       * cannot enable a second withdrawal of the same money.
       */
      await this.prisma.astrologerPayout.update({
        where: {
          id: reserved.id,
        },
        data: {
          failureReason:
            error instanceof Error
              ? error.message
              : 'Payout provider request failed',
        },
      });

      throw error;
    }
  }
  async getEarningsTransactions(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    const earnings = await this.prisma.astrologerEarning.findMany({
      where: {
        astrologerId: astrologer.id,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 100,

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
        transactions: earnings.map((earning) => ({
          id: earning.id,

          callSessionId: earning.callSessionId,

          type: 'earning',

          title: 'Consultation Earnings',

          grossAmount: Number(earning.grossAmount),

          platformFee: Number(earning.platformFee),

          netAmount: Number(earning.netAmount),

          currency: earning.currency,

          status: earning.status,

          availableAt: earning.availableAt,

          paidAt: earning.paidAt,

          reversedAt: earning.reversedAt,

          createdAt: earning.createdAt,

          consultation: {
            id: earning.callSession.id,

            customerId: earning.callSession.userId,

            customerName:
              earning.callSession.user.name ?? 'Astro Soul Path User',

            customerAvatarUrl: earning.callSession.user.avatarUrl ?? null,

            channelName: earning.callSession.channelName,

            ratePerMinute: Number(earning.callSession.ratePerMinute),

            purchasedMinutes: earning.callSession.purchasedMinutes,

            extendedMinutes: earning.callSession.extendedMinutes,

            amountCharged: Number(earning.callSession.amountCharged),

            startedAt: earning.callSession.startedAt,

            endedAt: earning.callSession.endedAt,

            status: earning.callSession.status,
          },
        })),

        total: earnings.length,
      },
    };
  }

  async getProfile(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    const userProfile = await this.prisma.userProfile.findUnique({
      where: {
        userId: astrologer.user.id,
      },
    });

    return {
      success: true,

      data: {
        fullName: userProfile?.fullName ?? astrologer.user.name ?? '',

        username: userProfile?.username ?? '',

        email: userProfile?.email ?? astrologer.user.email ?? '',

        phoneNumber: userProfile?.phoneNumber ?? astrologer.user.phone ?? '',

        dateOfBirth: userProfile?.dateOfBirth
          ? userProfile.dateOfBirth.toISOString().split('T')[0]
          : null,

        gender: userProfile?.gender ?? astrologer.Gender,

        location: userProfile?.location ?? '',

        bio: astrologer.bio ?? '',

        languages: astrologer.languages,

        expertise: astrologer.expertise.map((item) => item.expertise.name),

        experience: astrologer.experience ?? 0,

        pricePerMin: Number(astrologer.pricePerMin ?? 0),

        avatarUrl: astrologer.user.avatarUrl,
      },
    };
  }

  async updateProfile(supabaseId: string, dto: UpdateAstrologerProfileDto) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    let parsedDateOfBirth: Date | null | undefined;

    if (dto.dateOfBirth !== undefined) {
      const trimmedDate = dto.dateOfBirth.trim();

      if (!trimmedDate) {
        parsedDateOfBirth = null;
      } else {
        const date = new Date(trimmedDate);

        if (Number.isNaN(date.getTime())) {
          throw new BadRequestException('Invalid date of birth');
        }

        parsedDateOfBirth = date;
      }
    }

    const normalizedLanguages = dto.languages
      ? [
          ...new Set(
            dto.languages.map((language) => language.trim()).filter(Boolean),
          ),
        ]
      : undefined;

    const normalizedExpertise = dto.expertise
      ? [...new Set(dto.expertise.map((name) => name.trim()).filter(Boolean))]
      : undefined;
    const normalizedConsultationCategories =
      dto.consultationCategories !== undefined
        ? [
            ...new Set(
              dto.consultationCategories
                  .map((category) => category.trim().toLowerCase())
                  .filter(Boolean),
            ),
          ]
        : undefined;


    if (dto.languages && normalizedLanguages?.length === 0) {
      throw new BadRequestException('At least one language is required');
    }

    if (dto.expertise && normalizedExpertise?.length === 0) {
      throw new BadRequestException('At least one expertise is required');
    }

    const existingUserProfile = await this.prisma.userProfile.findUnique({
      where: {
        userId: astrologer.user.id,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: astrologer.user.id,
        },

        data: {
          ...(dto.fullName !== undefined
            ? {
                name: dto.fullName.trim() || null,
              }
            : {}),

          ...(dto.email !== undefined
            ? {
                email: dto.email.trim(),
              }
            : {}),

          ...(dto.phoneNumber !== undefined
            ? {
                phone: dto.phoneNumber.trim(),
              }
            : {}),

          ...(dto.gender !== undefined
            ? {
                gender: dto.gender,
              }
            : {}),
        },
      });

      const profileFullName =
        dto.fullName?.trim() ||
        existingUserProfile?.fullName ||
        astrologer.user.name?.trim() ||
        'Astro Soul Path Astrologer';

      const profileGender =
        dto.gender ??
        existingUserProfile?.gender ??
        astrologer.Gender ??
        'OTHER';

      await tx.userProfile.upsert({
        where: {
          userId: astrologer.user.id,
        },

        update: {
          ...(dto.fullName !== undefined
            ? {
                fullName: profileFullName,
              }
            : {}),

          ...(dto.username !== undefined
            ? {
                username: dto.username.trim() || null,
              }
            : {}),

          ...(dto.email !== undefined
            ? {
                email: dto.email.trim(),
              }
            : {}),

          ...(dto.phoneNumber !== undefined
            ? {
                phoneNumber: dto.phoneNumber.trim(),
              }
            : {}),

          ...(parsedDateOfBirth !== undefined
            ? {
                dateOfBirth: parsedDateOfBirth,
              }
            : {}),

          ...(dto.gender !== undefined
            ? {
                gender: dto.gender,
              }
            : {}),

          ...(dto.location !== undefined
            ? {
                location: dto.location.trim() || null,
              }
            : {}),
        },

        create: {
          userId: astrologer.user.id,

          fullName: profileFullName,

          username: dto.username?.trim() || null,

          email: dto.email?.trim() || astrologer.user.email || null,

          phoneNumber: dto.phoneNumber?.trim() || astrologer.user.phone || null,

          dateOfBirth: parsedDateOfBirth ?? null,

          gender: profileGender,

          location: dto.location?.trim() || null,

          avatarUrl: astrologer.user.avatarUrl ?? null,
        },
      });

      await tx.astrologer.update({
        where: {
          id: astrologer.id,
        },

        data: {
          ...(normalizedConsultationCategories !== undefined
              ? {
                  consultationCategories:
                    normalizedConsultationCategories,
                }
              : {}),

          ...(dto.gender !== undefined
            ? {
                Gender: dto.gender,
              }
            : {}),

          ...(dto.bio !== undefined
            ? {
                bio: dto.bio.trim() || null,
              }
            : {}),

          ...(normalizedLanguages !== undefined
            ? {
                languages: normalizedLanguages,
              }
            : {}),

          ...(dto.experience !== undefined
            ? {
                experience: dto.experience,
              }
            : {}),

          ...(dto.pricePerMin !== undefined
            ? {
                pricePerMin: dto.pricePerMin,
              }
            : {}),
        },
      });

      if (normalizedExpertise !== undefined) {
        const expertiseRecords = await Promise.all(
          normalizedExpertise.map((name) =>
            tx.expertise.upsert({
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

        await tx.astrologerExpertise.deleteMany({
          where: {
            astrologerId: astrologer.id,
          },
        });

        await tx.astrologerExpertise.createMany({
          data: expertiseRecords.map((expertise) => ({
            astrologerId: astrologer.id,

            expertiseId: expertise.id,
          })),

          skipDuplicates: true,
        });
      }
    });

    const updatedProfile = await this.getProfile(supabaseId);

    return {
      success: true,

      message: 'Astrologer profile updated successfully',

      data: updatedProfile.data,
    };
  }

  async getAvailability(supabaseId: string) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    const availability = await this.prisma.astrologerAvailability.findMany({
      where: {
        astrologerId: astrologer.id,
      },
      orderBy: {
        dayOfWeek: 'asc',
      },
    });

    return {
      success: true,
      data: {
        isOnline: astrologer.isOnline,
        timezone: availability[0]?.timezone ?? 'Asia/Kolkata',
        days: availability,
      },
    };
  }

  async updateAvailability(
    supabaseId: string,
    dto: UpdateAstrologerAvailabilityDto,
  ) {
    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    if (!astrologer.isApproved || !astrologer.isVerified) {
      throw new BadRequestException(
        'Only approved and verified astrologers can manage availability',
      );
    }

    const normalizedTimezone = dto.timezone.trim();

    if (!normalizedTimezone) {
      throw new BadRequestException('Timezone is required');
    }

    const uniqueDays = new Set(dto.days.map((day) => day.dayOfWeek));

    if (uniqueDays.size !== dto.days.length) {
      throw new BadRequestException(
        'Duplicate availability days are not allowed',
      );
    }

    for (const day of dto.days) {
      if (
        !/^\d{2}:\d{2}$/.test(day.startTime) ||
        !/^\d{2}:\d{2}$/.test(day.endTime)
      ) {
        throw new BadRequestException(
          'Availability time must use HH:mm format',
        );
      }

      if (day.isEnabled && day.startTime >= day.endTime) {
        throw new BadRequestException(
          'Availability start time must be before end time',
        );
      }
    }

    await this.prisma.$transaction(
      dto.days.map((day) =>
        this.prisma.astrologerAvailability.upsert({
          where: {
            astrologerId_dayOfWeek: {
              astrologerId: astrologer.id,
              dayOfWeek: day.dayOfWeek,
            },
          },
          update: {
            isEnabled: day.isEnabled,
            startTime: day.startTime,
            endTime: day.endTime,
            timezone: normalizedTimezone,
          },
          create: {
            astrologerId: astrologer.id,
            dayOfWeek: day.dayOfWeek,
            isEnabled: day.isEnabled,
            startTime: day.startTime,
            endTime: day.endTime,
            timezone: normalizedTimezone,
          },
        }),
      ),
    );

    return this.getAvailability(supabaseId);
  }
  async updateStatus(supabaseId: string, isOnline: boolean) {
    if (typeof isOnline !== 'boolean') {
      throw new BadRequestException('isOnline must be a boolean value');
    }

    const astrologer = await this.findAstrologerBySupabaseId(supabaseId);

    if (!astrologer.isApproved || !astrologer.isVerified) {
      throw new BadRequestException(
        'Only approved and verified astrologers can go online',
      );
    }

    const updated = await this.prisma.astrologer.update({
      where: {
        id: astrologer.id,
      },
      data: {
        isOnline,
      },
    });

    return {
      success: true,

      message: isOnline
        ? 'Astrologer is now online'
        : 'Astrologer is now offline',

      data: {
        astrologerId: updated.id,

        userId: astrologer.user.id,

        isOnline: updated.isOnline,
      },
    };
  }

  async getQualificationStatus(supabaseId: string) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const settings =
      await this.prisma.astrologerQualificationSettings.findUnique({
        where: { id: 'default' },
      });

    const effectiveSettings = settings ?? {
      isEnabled: true,
      questionCount: 10,
      passingPercentage: 70,
      allowRetake: true,
      maxAttempts: null,
      retakeCooldownMins: 0,
      randomizeQuestions: true,
      randomizeOptions: false,
      showScore: true,
      showCorrectAnswers: false,
    };

    const attempts = await this.prisma.astrologerQualificationAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        totalQuestions: true,
        correctAnswers: true,
        passingScore: true,
        passed: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const latestAttempt = attempts[0] ?? null;
    const passed = attempts.some((attempt) => attempt.passed);

    let canAttempt = effectiveSettings.isEnabled && !passed;
    let reason: string | null = null;

    if (!effectiveSettings.isEnabled) {
      canAttempt = false;
      reason = 'Qualification test is currently disabled';
    } else if (passed) {
      canAttempt = false;
      reason = 'Qualification test already passed';
    } else if (!effectiveSettings.allowRetake && attempts.length > 0) {
      canAttempt = false;
      reason = 'Qualification test retake is disabled';
    } else if (
      effectiveSettings.maxAttempts !== null &&
      attempts.length >= effectiveSettings.maxAttempts
    ) {
      canAttempt = false;
      reason = 'Maximum qualification attempts reached';
    } else if (
      effectiveSettings.retakeCooldownMins > 0 &&
      latestAttempt?.completedAt
    ) {
      const nextAttemptAt = new Date(
        latestAttempt.completedAt.getTime() +
          effectiveSettings.retakeCooldownMins * 60 * 1000,
      );

      if (nextAttemptAt.getTime() > Date.now()) {
        canAttempt = false;
        reason = 'Qualification retake cooldown is active';
      }
    }

    return {
      success: true,
      message: 'Qualification status fetched successfully',
      data: {
        enabled: effectiveSettings.isEnabled,
        passed,
        canAttempt,
        reason,
        attemptsUsed: attempts.length,
        maxAttempts: effectiveSettings.maxAttempts,
        questionCount: effectiveSettings.questionCount,
        passingPercentage: effectiveSettings.passingPercentage,
        showScore: effectiveSettings.showScore,
        latestAttempt:
          latestAttempt && effectiveSettings.showScore
            ? latestAttempt
            : latestAttempt
              ? {
                  id: latestAttempt.id,
                  passed: latestAttempt.passed,
                  completedAt: latestAttempt.completedAt,
                  createdAt: latestAttempt.createdAt,
                }
              : null,
      },
    };
  }

  async getQualificationQuestions(supabaseId: string) {
    const status = await this.getQualificationStatus(supabaseId);

    if (!status.data.enabled || !status.data.canAttempt) {
      throw new BadRequestException(
        status.data.reason ?? 'Qualification test cannot be attempted',
      );
    }

    const settings =
      await this.prisma.astrologerQualificationSettings.findUnique({
        where: { id: 'default' },
      });

    const questionCount = settings?.questionCount ?? 10;
    const randomizeQuestions = settings?.randomizeQuestions ?? true;

    const questions =
      await this.prisma.astrologerQualificationQuestion.findMany({
        where: { isActive: true },
        select: {
          id: true,
          question: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          category: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

    if (questions.length < questionCount) {
      throw new BadRequestException(
        `Qualification test requires ${questionCount} active questions, but only ${questions.length} are available`,
      );
    }

    const selectedQuestions = randomizeQuestions
      ? [...questions].sort(() => Math.random() - 0.5).slice(0, questionCount)
      : questions.slice(0, questionCount);

    return {
      success: true,
      message: 'Qualification questions fetched successfully',
      data: {
        questionCount,
        questions: selectedQuestions,
      },
    };
  }

  async submitQualification(
    supabaseId: string,
    answers: Array<{
      questionId: string;
      selectedOption: string;
    }>,
  ) {
    const normalizedSupabaseId = supabaseId?.trim();

    if (!normalizedSupabaseId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const mappedIdentity =
      await this.prisma.userAuthIdentity.findUnique({
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

    const user = await this.prisma.user.findUnique({
      where: mappedIdentity
        ? { id: mappedIdentity.userId }
        : { supabaseId: normalizedSupabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    const status = await this.getQualificationStatus(normalizedSupabaseId);

    if (!status.data.enabled || !status.data.canAttempt) {
      throw new BadRequestException(
        status.data.reason ?? 'Qualification test cannot be submitted',
      );
    }

    const settings =
      await this.prisma.astrologerQualificationSettings.findUnique({
        where: { id: 'default' },
      });

    const questionCount = settings?.questionCount ?? 10;
    const passingPercentage = settings?.passingPercentage ?? 70;
    const showScore = settings?.showScore ?? true;
    const showCorrectAnswers = settings?.showCorrectAnswers ?? false;

    if (answers.length !== questionCount) {
      throw new BadRequestException(
        `Exactly ${questionCount} answers are required`,
      );
    }

    const questionIds = answers.map((answer) => answer.questionId);

    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException(
        'Duplicate qualification question answers are not allowed',
      );
    }

    const questions =
      await this.prisma.astrologerQualificationQuestion.findMany({
        where: {
          id: { in: questionIds },
          isActive: true,
        },
        select: {
          id: true,
          correctOption: true,
          explanation: true,
        },
      });

    if (questions.length !== questionCount) {
      throw new BadRequestException(
        'One or more qualification questions are invalid or inactive',
      );
    }

    const questionMap = new Map(
      questions.map((question) => [question.id, question]),
    );

    let correctAnswers = 0;

    const evaluatedAnswers = answers.map((answer) => {
      const question = questionMap.get(answer.questionId);

      if (!question) {
        throw new BadRequestException('Invalid qualification question');
      }

      const selectedOption = answer.selectedOption.toUpperCase();
      const correctOption = question.correctOption.toUpperCase();
      const isCorrect = selectedOption === correctOption;

      if (isCorrect) {
        correctAnswers += 1;
      }

      return {
        questionId: answer.questionId,
        selectedOption,
        isCorrect,
        ...(showCorrectAnswers
          ? {
              correctOption,
              explanation: question.explanation,
            }
          : {}),
      };
    });

    const score = Number(((correctAnswers / questionCount) * 100).toFixed(2));

    const passed = score >= passingPercentage;

    const attempt = await this.prisma.astrologerQualificationAttempt.create({
      data: {
        userId: user.id,
        score,
        totalQuestions: questionCount,
        correctAnswers,
        passingScore: passingPercentage,
        passed,
        answers: evaluatedAnswers as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: passed
        ? 'Qualification test passed successfully'
        : 'Qualification test completed but passing score was not reached',
      data: {
        attemptId: attempt.id,
        passed,
        passingPercentage,
        ...(showScore
          ? {
              score,
              correctAnswers,
              totalQuestions: questionCount,
            }
          : {}),
        ...(showCorrectAnswers ? { answers: evaluatedAnswers } : {}),
      },
    };
  }
}
