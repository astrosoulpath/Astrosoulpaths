import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  private maskPhone(phone?: string | null): string | null {
    if (!phone) {
      return null;
    }

    const value = phone.trim();

    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    /*
     * Never expose complete customer mobile number publicly.
     *
     * Example:
     * +919187800123 -> +91918*****
     */
    const visibleLength = Math.min(6, Math.max(3, value.length - 5));

    return (
      value.substring(0, visibleLength) +
      '*'.repeat(Math.max(5, value.length - visibleLength))
    );
  }

  private customerLabel(
    name?: string | null,
    phone?: string | null,
  ): string {
    const masked = this.maskPhone(phone);

    /*
     * Reference UI primarily displays masked phone.
     * If phone is unavailable, use actual account name.
     * Never manufacture a fake customer identity.
     */
    if (masked) {
      return masked;
    }

    if (name?.trim()) {
      return name.trim();
    }

    return 'Customer';
  }

  async getHomepageReviews() {
    const reviews = await this.prisma.review.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,

        user: {
          select: {
            name: true,
            phone: true,
          },
        },

        astrologer: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,

      data: reviews.map((review) => ({
        id: review.id,

        customerName: this.customerLabel(
          review.user.name,
          review.user.phone,
        ),

        rating: review.rating,
        review: review.comment ?? '',

        astrologerName:
          review.astrologer.user.name || 'Astrologer',

        createdAt: review.createdAt,
      })),
    };
  }

  async getAstrologerReviews(astrologerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        astrologerId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,

        user: {
          select: {
            name: true,
            phone: true,
            userProfile: {
              select: {
                country: true,
                countryCode: true,
              },
            },
          },
        },
        callSession: {
          select: {
            mode: true,
          },
        },
      },
    });

    const summary = await this.prisma.review.aggregate({
      where: {
        astrologerId,
      },

      _avg: {
        rating: true,
      },

      _count: {
        id: true,
      },
    });

    return {
      success: true,
      astrologerId,

      averageRating:
        summary._avg.rating === null
          ? 0
          : Number(summary._avg.rating.toFixed(2)),

      totalReviews: summary._count.id,

      data: reviews.map((review) => ({
        id: review.id,

        customerName: this.customerLabel(
          review.user.name,
          review.user.phone,
        ),

        country: review.user.userProfile?.country ?? '',
        countryCode: review.user.userProfile?.countryCode ?? '',

        rating: review.rating,
        review: review.comment ?? '',
        consultationType: review.callSession.mode,
        createdAt: review.createdAt,
      })),
    };
  }

  async createReview(
    authenticatedUserId: string | undefined,
    dto: CreateReviewDto,
  ) {
    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        'Authenticated customer is required',
      );
    }

    const callSessionId = dto.callSessionId?.trim();

    if (!callSessionId) {
      throw new BadRequestException(
        'callSessionId is required',
      );
    }

    if (
      !Number.isInteger(dto.rating) ||
      dto.rating < 1 ||
      dto.rating > 5
    ) {
      throw new BadRequestException(
        'Rating must be between 1 and 5',
      );
    }

    const comment =
      typeof dto.comment === 'string'
        ? dto.comment.trim()
        : '';

    if (comment.length > 1000) {
      throw new BadRequestException(
        'Review comment must not exceed 1000 characters',
      );
    }

    /*
     * Never trust astrologerId/customerId from Flutter.
     * Resolve the relationship entirely from server-owned CallSession.
     */
    const callSession =
      await this.prisma.callSession.findUnique({
        where: {
          id: callSessionId,
        },

        select: {
          id: true,
          userId: true,
          astrologerId: true,
          endedAt: true,
          status: true,
          review: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!callSession) {
      throw new NotFoundException(
        'Consultation not found',
      );
    }

    /*
     * The authenticated user must be the consultation customer.
     */
    if (callSession.userId !== authenticatedUserId) {
      throw new ForbiddenException(
        'You can review only your own consultation',
      );
    }

    /*
     * Do not allow rating while consultation is still active.
     * endedAt is server-owned and safer than trusting a client status.
     */
    if (!callSession.endedAt) {
      throw new BadRequestException(
        'Review can be submitted only after consultation ends',
      );
    }

    if (callSession.review) {
      throw new ConflictException(
        'This consultation has already been reviewed',
      );
    }

    /*
     * IMPORTANT DATA MODEL TRANSLATION:
     *
     * CallSession.astrologerId = astrologer USER id
     * Review.astrologerId      = Astrologer profile id
     */
    const astrologer =
      await this.prisma.astrologer.findUnique({
        where: {
          userId: callSession.astrologerId,
        },

        select: {
          id: true,
          isApproved: true,
        },
      });

    if (!astrologer) {
      throw new NotFoundException(
        'Astrologer profile not found',
      );
    }

    if (!astrologer.isApproved) {
      throw new BadRequestException(
        'Astrologer is not available for review',
      );
    }

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          /*
           * callSessionId has @unique at DB level.
           * That is final protection against simultaneous
           * duplicate submissions.
           */
          const created = await tx.review.create({
            data: {
              astrologerId: astrologer.id,
              userId: authenticatedUserId,
              callSessionId: callSession.id,
              rating: dto.rating,
              comment: comment || null,
            },

            select: {
              id: true,
              astrologerId: true,
              userId: true,
              callSessionId: true,
              rating: true,
              comment: true,
              createdAt: true,
            },
          });

          /*
           * Recalculate aggregate from Review table itself.
           * Never trust a rating number sent by Flutter.
           */
          const summary = await tx.review.aggregate({
            where: {
              astrologerId: astrologer.id,
            },

            _avg: {
              rating: true,
            },

            _count: {
              id: true,
            },
          });

          const averageRating =
            summary._avg.rating === null
              ? 0
              : Number(
                  summary._avg.rating.toFixed(2),
                );

          /*
           * Keep cached Astrologer rating fields synced
           * with real Review rows.
           */
          await tx.astrologer.update({
            where: {
              id: astrologer.id,
            },

            data: {
              rating: averageRating,
              totalReviews: summary._count.id,
            },
          });

          return {
            created,
            averageRating,
            totalReviews: summary._count.id,
          };
        },
      );

      return {
        success: true,
        message: 'Review submitted successfully',

        review: result.created,

        summary: {
          averageRating: result.averageRating,
          totalReviews: result.totalReviews,
        },
      };
    } catch (error: any) {
      /*
       * Prisma P2002 = unique constraint violation.
       * callSessionId is unique, so concurrent double taps
       * cannot create duplicate reviews.
       */
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'This consultation has already been reviewed',
        );
      }

      throw error;
    }
  }
}


