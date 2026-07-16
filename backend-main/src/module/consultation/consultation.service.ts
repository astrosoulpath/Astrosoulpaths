import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  ConsultationPaginationParams,
  ConsultationRepository,
} from './consultation.repository';

export type StartConsultationParams = {
  userId: string;

  /**
   * This must be the astrologer's User.id,
   * not the Astrologer.id.
   */
  astrologerUserId: string;

  purchasedMinutes: number;
};

export type ExtendConsultationServiceParams = {
  consultationId: string;
  userId: string;
  additionalMinutes: number;
};

export type CancelConsultationParams = {
  consultationId: string;
  requestedByUserId: string;
};

export type CompleteConsultationServiceParams = {
  consultationId: string;
  requestedByUserId: string;
};

export type RateConsultationParams = {
  consultationId: string;
  userId: string;
  rating: number;
  comment?: string;
};

@Injectable()
export class ConsultationService {
  constructor(
    private readonly consultationRepository: ConsultationRepository,
  ) {}

  /*
   * ============================================================
   * START CONSULTATION
   * ============================================================
   */

  async startConsultation(params: StartConsultationParams) {
    const userId = params.userId?.trim();
    const astrologerUserId =
      params.astrologerUserId?.trim();
    const purchasedMinutes = Math.floor(
      params.purchasedMinutes,
    );

    if (!userId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    if (!astrologerUserId) {
      throw new BadRequestException(
        'Astrologer ID is required',
      );
    }

    if (userId === astrologerUserId) {
      throw new BadRequestException(
        'A user cannot start a consultation with themselves',
      );
    }

    if (
      !Number.isFinite(purchasedMinutes) ||
      purchasedMinutes < 1 ||
      purchasedMinutes > 180
    ) {
      throw new BadRequestException(
        'Purchased minutes must be between 1 and 180',
      );
    }

    /*
     * Fast checks before entering the database transaction.
     * The repository repeats these checks inside its transaction
     * to protect against concurrent duplicate requests.
     */
    const existingConsultation =
      await this.consultationRepository.findActiveUserConsultation(
        userId,
      );

    if (existingConsultation) {
      throw new ConflictException(
        'You already have an active consultation',
      );
    }

    const astrologerActiveConsultation =
      await this.consultationRepository.findActiveAstrologerConsultation(
        astrologerUserId,
      );

    if (astrologerActiveConsultation) {
      throw new ConflictException(
        'The astrologer is currently busy with another consultation',
      );
    }

    const astrologer =
      await this.consultationRepository.findAvailableAstrologerByUserId(
        astrologerUserId,
      );

    if (!astrologer) {
      throw new BadRequestException(
        'The astrologer is unavailable, offline, unverified, or not approved',
      );
    }

    const ratePerMinute = Number(
      astrologer.pricePerMin ?? 0,
    );

    if (
      !Number.isFinite(ratePerMinute) ||
      ratePerMinute <= 0
    ) {
      throw new BadRequestException(
        'The astrologer consultation price is not configured',
      );
    }

    const amountCharged = this.roundMoney(
      ratePerMinute * purchasedMinutes,
    );

    const startedAt = new Date();

    const expiresAt = this.addMinutes(
      startedAt,
      purchasedMinutes,
    );

    const channelName =
      this.createChannelName();

    /*
     * The repository performs these operations atomically:
     *
     * 1. Re-check active consultations
     * 2. Check wallet balance
     * 3. Create CallSession
     * 4. Deduct wallet balance
     * 5. Create WalletLedger entry
     */
    const {
      consultation,
      wallet,
      transaction,
    } =
      await this.consultationRepository.createConsultation(
        {
          userId,
          astrologerId: astrologerUserId,
          channelName,
          ratePerMinute,
          purchasedMinutes,
          amountCharged,
          startedAt,
          expiresAt,
          status: 'ACTIVE',
        },
      );

    return {
      success: true,
      message:
        'Consultation started successfully',
      data: {
        call: consultation,
        wallet,
        transaction,
      },
    };
  }

  /*
   * ============================================================
   * CURRENT CUSTOMER CONSULTATION
   * ============================================================
   */

  async getCurrentUserConsultation(
    userId: string,
  ) {
    const normalizedUserId =
      userId?.trim();

    if (!normalizedUserId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    const consultation =
      await this.consultationRepository.findActiveUserConsultation(
        normalizedUserId,
      );

    return {
      success: true,
      data: consultation,
    };
  }

  /*
   * ============================================================
   * CURRENT ASTROLOGER CONSULTATION
   * ============================================================
   */

  async getCurrentAstrologerConsultation(
    astrologerUserId: string,
  ) {
    const normalizedAstrologerUserId =
      astrologerUserId?.trim();

    if (!normalizedAstrologerUserId) {
      throw new BadRequestException(
        'Astrologer user ID is required',
      );
    }

    const consultation =
      await this.consultationRepository.findActiveAstrologerConsultation(
        normalizedAstrologerUserId,
      );

    return {
      success: true,
      data: consultation,
    };
  }

  /*
   * ============================================================
   * CONSULTATION DETAILS
   * ============================================================
   */

  async getConsultationById(
    consultationId: string,
    requestedByUserId: string,
  ) {
    const normalizedConsultationId =
      consultationId?.trim();

    const normalizedRequestedByUserId =
      requestedByUserId?.trim();

    if (!normalizedConsultationId) {
      throw new BadRequestException(
        'Consultation ID is required',
      );
    }

    if (!normalizedRequestedByUserId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const consultation =
      await this.consultationRepository.findConsultationById(
        normalizedConsultationId,
      );

    this.ensureParticipant(
      consultation,
      normalizedRequestedByUserId,
    );

    return {
      success: true,
      data: consultation,
    };
  }

  /*
   * ============================================================
   * CUSTOMER CONSULTATION HISTORY
   * ============================================================
   */

  async getUserConsultationHistory(
    userId: string,
    params: ConsultationPaginationParams = {},
  ) {
    const normalizedUserId =
      userId?.trim();

    if (!normalizedUserId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    const result =
      await this.consultationRepository.findUserConsultationHistory(
        normalizedUserId,
        params,
      );

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  /*
   * ============================================================
   * ASTROLOGER CONSULTATION HISTORY
   * ============================================================
   */

  async getAstrologerConsultationHistory(
    astrologerUserId: string,
    params: ConsultationPaginationParams = {},
  ) {
    const normalizedAstrologerUserId =
      astrologerUserId?.trim();

    if (!normalizedAstrologerUserId) {
      throw new BadRequestException(
        'Astrologer user ID is required',
      );
    }

    const result =
      await this.consultationRepository.findAstrologerConsultationHistory(
        normalizedAstrologerUserId,
        params,
      );

    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
    };
  }

  /*
   * ============================================================
   * EXTEND CONSULTATION
   * ============================================================
   */

  async extendConsultation(
    params: ExtendConsultationServiceParams,
  ) {
    const consultationId =
      params.consultationId?.trim();

    const userId =
      params.userId?.trim();

    const additionalMinutes = Math.floor(
      params.additionalMinutes,
    );

    if (!consultationId) {
      throw new BadRequestException(
        'Consultation ID is required',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    if (
      !Number.isFinite(additionalMinutes) ||
      additionalMinutes < 1 ||
      additionalMinutes > 180
    ) {
      throw new BadRequestException(
        'Additional minutes must be between 1 and 180',
      );
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    if (consultation.userId !== userId) {
      throw new ForbiddenException(
        'Only the customer can extend this consultation',
      );
    }

    if (consultation.endedAt) {
      throw new ConflictException(
        'A completed or cancelled consultation cannot be extended',
      );
    }

    const normalizedStatus =
      consultation.status.toUpperCase();

    if (
      [
        'CANCELLED',
        'COMPLETED',
        'ENDED',
        'EXPIRED',
      ].includes(normalizedStatus)
    ) {
      throw new ConflictException(
        'This consultation can no longer be extended',
      );
    }

    const additionalAmount =
      this.roundMoney(
        consultation.ratePerMinute *
          additionalMinutes,
      );

    const expiryBase =
      consultation.expiresAt.getTime() >
      Date.now()
        ? consultation.expiresAt
        : new Date();

    const newExpiresAt =
      this.addMinutes(
        expiryBase,
        additionalMinutes,
      );

    /*
     * The repository atomically:
     *
     * 1. Checks the consultation
     * 2. Checks wallet balance
     * 3. Deducts the amount
     * 4. Extends the consultation
     * 5. Adds a wallet ledger entry
     */
    const {
      consultation: updatedConsultation,
      wallet,
      transaction,
    } =
      await this.consultationRepository.extendConsultation(
        consultationId,
        {
          additionalMinutes,
          additionalAmount,
          newExpiresAt,
        },
      );

    return {
      success: true,
      message:
        'Consultation extended successfully',

      /*
       * Keep consultation directly inside `data`
       * because the website's current consultation
       * pages read response.data.expiresAt.
       */
      data: updatedConsultation,

      wallet,
      transaction,
    };
  }

  /*
   * ============================================================
   * CANCEL CONSULTATION
   * ============================================================
   */

  async cancelConsultation(
    params: CancelConsultationParams,
  ) {
    const consultationId =
      params.consultationId?.trim();

    const requestedByUserId =
      params.requestedByUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException(
        'Consultation ID is required',
      );
    }

    if (!requestedByUserId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    this.ensureParticipant(
      consultation,
      requestedByUserId,
    );

    if (consultation.endedAt) {
      throw new ConflictException(
        'This consultation has already ended',
      );
    }

    const normalizedStatus =
      consultation.status.toUpperCase();

    if (normalizedStatus === 'COMPLETED') {
      throw new ConflictException(
        'A completed consultation cannot be cancelled',
      );
    }

    if (normalizedStatus === 'CANCELLED') {
      throw new ConflictException(
        'This consultation is already cancelled',
      );
    }

    const cancelledConsultation =
      await this.consultationRepository.cancelConsultation(
        consultationId,
        'CANCELLED',
      );

    return {
      success: true,
      message:
        'Consultation cancelled successfully',
      data: cancelledConsultation,
    };
  }

  /*
   * ============================================================
   * COMPLETE CONSULTATION
   * ============================================================
   */

  async completeConsultation(
    params: CompleteConsultationServiceParams,
  ) {
    const consultationId =
      params.consultationId?.trim();

    const requestedByUserId =
      params.requestedByUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException(
        'Consultation ID is required',
      );
    }

    if (!requestedByUserId) {
      throw new BadRequestException(
        'Authenticated user ID is required',
      );
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    this.ensureParticipant(
      consultation,
      requestedByUserId,
    );

    const normalizedStatus =
      consultation.status.toUpperCase();

    if (
      consultation.endedAt &&
      normalizedStatus === 'COMPLETED'
    ) {
      const completedConsultation =
        await this.consultationRepository.findConsultationById(
          consultationId,
        );

      return {
        success: true,
        message:
          'Consultation is already completed',
        data: completedConsultation,
      };
    }

    if (consultation.endedAt) {
      throw new ConflictException(
        'This consultation has already ended',
      );
    }

    if (normalizedStatus === 'CANCELLED') {
      throw new ConflictException(
        'A cancelled consultation cannot be completed',
      );
    }

    /*
     * Wallet deduction already occurred when the
     * consultation started or was extended.
     *
     * Completion creates/updates AstrologerEarning
     * and applies the platform commission.
     */
    const completedConsultation =
      await this.consultationRepository.completeConsultation(
        consultationId,
        {
          amountCharged: this.roundMoney(
            consultation.amountCharged,
          ),
          endedAt: new Date(),
          status: 'COMPLETED',
          platformFeePercent: 20,
        },
      );

    return {
      success: true,
      message:
        'Consultation completed successfully',
      data: completedConsultation,
    };
  }

  /*
   * ============================================================
   * RATING AND REVIEW
   * ============================================================
   */

  async rateConsultation(
    params: RateConsultationParams,
  ) {
    const consultationId =
      params.consultationId?.trim();

    const userId =
      params.userId?.trim();

    const rating = Math.floor(
      params.rating,
    );

    if (!consultationId) {
      throw new BadRequestException(
        'Consultation ID is required',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    if (
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new BadRequestException(
        'Rating must be between 1 and 5',
      );
    }

    const comment =
      params.comment?.trim();

    if (
      comment &&
      comment.length > 1000
    ) {
      throw new BadRequestException(
        'Review comment cannot exceed 1000 characters',
      );
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    if (
      consultation.userId !== userId
    ) {
      throw new ForbiddenException(
        'Only the customer can rate this consultation',
      );
    }

    if (
      !consultation.endedAt ||
      consultation.status.toUpperCase() !==
        'COMPLETED'
    ) {
      throw new ConflictException(
        'The consultation must be completed before adding a rating',
      );
    }

    /*
     * CallSession.astrologerId contains User.id,
     * while Review.astrologerId requires Astrologer.id.
     */
    const astrologer =
      await this.consultationRepository.findAstrologerByUserId(
        consultation.astrologerId,
      );

    const alreadyReviewed =
      await this.consultationRepository.hasUserReviewedAstrologer(
        userId,
        astrologer.id,
      );

    if (alreadyReviewed) {
      throw new ConflictException(
        'You have already reviewed this astrologer',
      );
    }

    const review =
      await this.consultationRepository.createReview(
        {
          userId,
          astrologerId: astrologer.id,
          rating,
          comment:
            comment || undefined,
        },
      );

    const ratingSummary =
      await this.consultationRepository.getAstrologerRatingSummary(
        astrologer.id,
      );

    const averageRating = Number(
      (
        ratingSummary._avg.rating ??
        rating
      ).toFixed(2),
    );

    const totalReviews =
      ratingSummary._count.id;

    await this.consultationRepository.updateAstrologerRating(
      astrologer.id,
      averageRating,
      totalReviews,
    );

    return {
      success: true,
      message:
        'Consultation rated successfully',
      data: {
        review,
        astrologerRating:
          averageRating,
        totalReviews,
      },
    };
  }

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  private ensureParticipant(
    consultation: {
      userId: string;
      astrologerId: string;
    },
    requestedByUserId: string,
  ) {
    if (
      consultation.userId !==
        requestedByUserId &&
      consultation.astrologerId !==
        requestedByUserId
    ) {
      throw new ForbiddenException(
        'You are not allowed to access this consultation',
      );
    }
  }

  private createChannelName() {
    return `consultation_${randomUUID().replace(
      /-/g,
      '',
    )}`;
  }

  private addMinutes(
    date: Date,
    minutes: number,
  ) {
    return new Date(
      date.getTime() +
        minutes * 60_000,
    );
  }

  private roundMoney(value: number) {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new BadRequestException(
        'Invalid monetary amount',
      );
    }

    return (
      Math.round(
        (value + Number.EPSILON) *
          100,
      ) / 100
    );
  }
}