import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import { ChatMessageType } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import {
  ConsultationPaginationParams,
  ConsultationRepository,
} from './consultation.repository';

import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsPushService } from '../notifications/notifications.push.service';

const AI_WELCOME_MESSAGE_CLIENT_ID_PREFIX = 'astro-ai-welcome-v1';

const AI_WELCOME_MESSAGE =
  'Namaste! Main Astro Soul Path AI Assistant hoon. Kripya apna naam, date of birth, time of birth, place of birth aur apna main question share karein.';

export type StartConsultationParams = {
  userId: string;

  /**
   * This must be the astrologer's User.id,
   * not the Astrologer.id.
   */
  astrologerUserId: string;

  purchasedMinutes: number;

  mode: 'chat' | 'audio' | 'video';

  astrologyQuestionId?: string;
  astrologyQuestionText?: string;
  astrologyCategorySlug?: string;
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

export type AcceptConsultationParams = {
  consultationId: string;
  astrologerUserId: string;
};

export type RejectConsultationParams = {
  consultationId: string;
  astrologerUserId: string;
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

const DEFAULT_PLATFORM_FEE_PERCENT = 30;

@Injectable()
export class ConsultationService {
  constructor(
    private readonly consultationRepository: ConsultationRepository,
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
    private readonly notificationsPushService: NotificationsPushService,
  ) {}

  private async getPlatformFeePercent(): Promise<number> {
    try {
      const settings = await this.prisma.platformSettings.upsert({
        where: {
          id: 'default',
        },
        update: {},
        create: {
          id: 'default',
          platformCommissionPercent: DEFAULT_PLATFORM_FEE_PERCENT,
        },
      });

      const configuredPercent = Number(
        settings.platformCommissionPercent.toString(),
      );

      if (
        !Number.isFinite(configuredPercent) ||
        configuredPercent < 0 ||
        configuredPercent > 100
      ) {
        return DEFAULT_PLATFORM_FEE_PERCENT;
      }

      return configuredPercent;
    } catch {
      return DEFAULT_PLATFORM_FEE_PERCENT;
    }
  }
  private async releaseExpiredCustomerReservations(
    userId: string,
  ): Promise<void> {
    const expiredConsultations = await this.prisma.callSession.findMany({
      where: {
        userId,

        status: 'PENDING',
        endedAt: null,
        expiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const consultation of expiredConsultations) {
      try {
        await this.consultationRepository.cancelConsultation(
          consultation.id,
          'EXPIRED',
        );
      } catch (error) {
        if (
          error instanceof ConflictException ||
          error instanceof NotFoundException
        ) {
          continue;
        }

        throw error;
      }
    }
  }

  /*
   * ============================================================
   * START CONSULTATION
   * ============================================================
   */

  async startConsultation(params: StartConsultationParams) {
    let userId = params.userId?.trim();

    const astrologerUserId = params.astrologerUserId?.trim();

    const requestedMinutes = Math.floor(params.purchasedMinutes);

    const mode = params.mode;

    if (mode !== 'chat' && mode !== 'audio' && mode !== 'video') {
      throw new BadRequestException(
        'Consultation mode must be chat, audio or video',
      );
    }

    /*
     * VIDEO CALL ADMIN CONTROL
     *
     * Block a new VIDEO consultation before wallet reservation,
     * pending CallSession creation, or Agora token generation.
     *
     * Chat and audio consultations are intentionally untouched.
     */
    if (mode === 'video') {
      const platformSettings = await this.prisma.platformSettings.upsert({
        where: {
          id: 'default',
        },
        update: {},
        create: {
          id: 'default',
        },
      });

      if (!platformSettings.videoCallEnabled) {
        throw new BadRequestException(
          'Video calling is currently disabled by administrator. [VIDEO_CALL_DISABLED_BY_ADMIN:CONSULTATION_START]',
        );
      }
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const databaseUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            id: userId,
          },
          {
            supabaseId: userId,
          },
        ],
      },
      select: {
        id: true,
        isActive: true,
        isBlocked: true,
        freeChatGrantedAt: true,
        freeChatUsedAt: true,
        freeChatMinutes: true,
      },
    });

    if (!databaseUser) {
      throw new NotFoundException(
        'Authenticated customer account was not found',
      );
    }

    if (!databaseUser.isActive || databaseUser.isBlocked) {
      throw new ForbiddenException('Customer account is inactive or blocked');
    }

    userId = databaseUser.id;

    if (!astrologerUserId) {
      throw new BadRequestException('Astrologer ID is required');
    }

    if (userId === astrologerUserId) {
      throw new BadRequestException(
        'A user cannot start a consultation with themselves',
      );
    }

    if (
      !Number.isFinite(requestedMinutes) ||
      requestedMinutes < 1 ||
      requestedMinutes > 180
    ) {
      throw new BadRequestException(
        'Purchased minutes must be between 1 and 180',
      );
    }

    const freeChatEligible =
      mode === 'chat' &&
      databaseUser.freeChatGrantedAt !== null &&
      databaseUser.freeChatUsedAt === null;

    const purchasedMinutes = freeChatEligible ? 1 : requestedMinutes;

    await this.releaseExpiredCustomerReservations(userId);

    /*
     * Fast checks before entering the database transaction.
     * The repository repeats these checks inside its transaction
     * to protect against concurrent duplicate requests.
     */
    const existingConsultation =
      await this.consultationRepository.findActiveUserConsultation(userId);

    if (existingConsultation) {
      throw new ConflictException('You already have an active consultation');
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

    const ratePerMinute = Number(astrologer.pricePerMin ?? 0);

    if (!Number.isFinite(ratePerMinute) || ratePerMinute <= 0) {
      throw new BadRequestException(
        'The astrologer consultation price is not configured',
      );
    }

    const amountCharged = this.roundMoney(ratePerMinute * purchasedMinutes);

    const startedAt = new Date();

    // Pending consultation requests expire quickly.
    // The actual paid consultation timer starts only after
    // the astrologer accepts the request.
    const expiresAt = this.addMinutes(startedAt, 2);

    const channelName = this.createChannelName();

    /*
     * The repository performs these operations atomically:
     *
     * 1. Re-check active consultations
     * 2. Check wallet balance
     * 3. Create a PENDING CallSession
     * 4. Reserve the amount in wallet.lockedBalance
     *
     * No wallet deduction occurs until the astrologer accepts.
     */
    const { consultation, wallet, transaction } =
      await this.consultationRepository.createConsultation({
        userId,
        astrologerId: astrologerUserId,
        channelName,
        mode,
        ratePerMinute,
        purchasedMinutes,
        amountCharged,
        startedAt,
        expiresAt,
        astrologyQuestionId: params.astrologyQuestionId?.trim() || undefined,
        astrologyQuestionText:
          params.astrologyQuestionText?.trim() || undefined,
        astrologyCategorySlug:
          params.astrologyCategorySlug?.trim() || undefined,
        status: 'PENDING',
      });

    return {
      success: true,
      message: 'Consultation request sent successfully',
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

  async getCurrentUserConsultation(userId: string) {
    const normalizedUserId = userId?.trim();

    if (!normalizedUserId) {
      throw new BadRequestException('User ID is required');
    }

    await this.releaseExpiredCustomerReservations(normalizedUserId);

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

  async getCurrentAstrologerConsultation(astrologerUserId: string) {
    const normalizedAstrologerUserId = astrologerUserId?.trim();

    if (!normalizedAstrologerUserId) {
      throw new BadRequestException('Astrologer user ID is required');
    }

    const consultations =
      await this.consultationRepository.findActiveAstrologerConsultation(
        normalizedAstrologerUserId,
      );

    return {
      success: true,
      data: consultations,
    };
  }

  /*
   * ============================================================
   * CONSULTATION DETAILS
   * ============================================================
   */

  async getConsultationQueuePosition(
    consultationId: string,
    requestedByUserId: string,
  ) {
    const normalizedConsultationId = consultationId?.trim();
    const normalizedRequestedByUserId = requestedByUserId?.trim();

    if (!normalizedConsultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!normalizedRequestedByUserId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        normalizedConsultationId,
      );

    this.ensureParticipant(consultation, normalizedRequestedByUserId);

    const queue =
      await this.consultationRepository.getConsultationQueuePosition(
        normalizedConsultationId,
      );

    return {
      success: true,
      data: {
        consultationId: normalizedConsultationId,
        ...queue,
      },
    };
  }
  async getConsultationById(consultationId: string, requestedByUserId: string) {
    const normalizedConsultationId = consultationId?.trim();

    const normalizedRequestedByUserId = requestedByUserId?.trim();

    if (!normalizedConsultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!normalizedRequestedByUserId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const consultation = await this.consultationRepository.findConsultationById(
      normalizedConsultationId,
    );

    this.ensureParticipant(consultation, normalizedRequestedByUserId);

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
    const normalizedUserId = userId?.trim();

    if (!normalizedUserId) {
      throw new BadRequestException('User ID is required');
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
    const normalizedAstrologerUserId = astrologerUserId?.trim();

    if (!normalizedAstrologerUserId) {
      throw new BadRequestException('Astrologer user ID is required');
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
   * ACCEPT CONSULTATION REQUEST
   * ============================================================
   */

  async acceptConsultation(params: AcceptConsultationParams) {
    const consultationId = params.consultationId?.trim();
    const astrologerUserId = params.astrologerUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!astrologerUserId) {
      throw new BadRequestException('Astrologer user ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    if (consultation.astrologerId !== astrologerUserId) {
      throw new ForbiddenException(
        'Only the assigned astrologer can accept this consultation',
      );
    }

    if (consultation.endedAt) {
      throw new ConflictException(
        'This consultation request has already ended',
      );
    }

    if (consultation.status.toUpperCase() !== 'PENDING') {
      throw new ConflictException(
        'Only a pending consultation can be accepted',
      );
    }

    if (consultation.expiresAt.getTime() <= Date.now()) {
      await this.consultationRepository.cancelConsultation(
        consultationId,
        'EXPIRED',
      );

      throw new ConflictException('This consultation request has expired');
    }

    const result =
      await this.consultationRepository.acceptConsultation(consultationId);

    const welcomeMessageClientId = `${AI_WELCOME_MESSAGE_CLIENT_ID_PREFIX}:${consultationId}`;

    const automatedMessage = await this.prisma.chatMessage.upsert({
      where: {
        senderId_clientMessageId: {
          senderId: astrologerUserId,
          clientMessageId: welcomeMessageClientId,
        },
      },

      update: {},

      create: {
        callSessionId: consultationId,
        senderId: astrologerUserId,
        clientMessageId: welcomeMessageClientId,
        messageType: ChatMessageType.SYSTEM,
        content: 'Welcome to Astro Soul Path',
        isRead: false,
        readAt: null,
      },

      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isAstrologer: true,
          },
        },
      },
    });

    this.chatGateway.server.to(consultationId).emit('consultation:accepted', {
      consultationId,
      callSessionId: consultationId,
      status: result.consultation.status,
      startedAt: result.consultation.startedAt,
      expiresAt: result.consultation.expiresAt,
    });

    try {
      await this.notificationsPushService.sendToUser(consultation.userId, {
        title: 'Consultation accepted',
        body: 'Your astrologer accepted your consultation request.',
        data: {
          type: 'CONSULTATION_ACCEPTED',
          consultationId,
          callSessionId: consultationId,
        },
      });
    } catch {
      // Acceptance must not fail if push delivery fails.
    }

    this.chatGateway.server.to(consultationId).emit('chat:message', {
      callSessionId: consultationId,
      message: {
        id: automatedMessage.id,
        callSessionId: automatedMessage.callSessionId,
        senderId: automatedMessage.senderId,
        clientMessageId: automatedMessage.clientMessageId,
        sender: automatedMessage.sender,
        messageType: automatedMessage.messageType,
        content: automatedMessage.content,
        attachment: null,
        isRead: automatedMessage.isRead,
        readAt: automatedMessage.readAt,
        createdAt: automatedMessage.createdAt,
        updatedAt: automatedMessage.updatedAt,
      },
    });

    return {
      success: true,
      message: 'Consultation accepted successfully',

      data: {
        call: result.consultation,
        wallet: result.wallet,
        transaction: result.transaction,
        automatedMessage,
      },
    };
  }
  /*
   * ============================================================
   * REJECT CONSULTATION REQUEST
   * ============================================================
   */

  async rejectConsultation(params: RejectConsultationParams) {
    const consultationId = params.consultationId?.trim();
    const astrologerUserId = params.astrologerUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!astrologerUserId) {
      throw new BadRequestException('Astrologer user ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    if (consultation.astrologerId !== astrologerUserId) {
      throw new ForbiddenException(
        'Only the assigned astrologer can reject this consultation',
      );
    }

    if (consultation.endedAt) {
      throw new ConflictException(
        'This consultation request has already ended',
      );
    }

    if (consultation.status.toUpperCase() !== 'PENDING') {
      throw new ConflictException(
        'Only a pending consultation can be rejected',
      );
    }

    const rejectedConsultation =
      await this.consultationRepository.rejectConsultation(consultationId);

    this.chatGateway.server.to(consultationId).emit('consultation:rejected', {
      consultationId,
      callSessionId: consultationId,
      status: rejectedConsultation.status,
      endedAt: rejectedConsultation.endedAt,
    });

    try {
      await this.notificationsPushService.sendToUser(consultation.userId, {
        title: 'Consultation declined',
        body: 'The astrologer declined your consultation request.',
        data: {
          type: 'CONSULTATION_REJECTED',
          consultationId,
          callSessionId: consultationId,
        },
      });
    } catch {
      // Rejection must succeed even if push delivery fails.
    }

    return {
      success: true,
      message: 'Consultation rejected successfully',
      data: rejectedConsultation,
    };
  }

  /*
   * ============================================================
   * EXTEND CONSULTATION
   * ============================================================
   */

  async extendConsultation(params: ExtendConsultationServiceParams) {
    const consultationId = params.consultationId?.trim();

    const userId = params.userId?.trim();

    const additionalMinutes = Math.floor(params.additionalMinutes);

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (
      !Number.isFinite(additionalMinutes) ||
      (additionalMinutes !== 5 && additionalMinutes !== 10)
    ) {
      throw new BadRequestException(
        'Consultation can only be extended by 5 or 10 minutes',
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

    const normalizedStatus = consultation.status.toUpperCase();

    if (normalizedStatus !== 'ACTIVE') {
      throw new ConflictException(
        'Only an active consultation can be extended',
      );
    }

    const additionalAmount = this.roundMoney(
      consultation.ratePerMinute * additionalMinutes,
    );

    const expiryBase =
      consultation.expiresAt.getTime() > Date.now()
        ? consultation.expiresAt
        : new Date();

    const newExpiresAt = this.addMinutes(expiryBase, additionalMinutes);

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
    } = await this.consultationRepository.extendConsultation(consultationId, {
      additionalMinutes,
      additionalAmount,
      newExpiresAt,
    });

    this.chatGateway.server.to(consultationId).emit('chat:extended', {
      callSessionId: consultationId,
      additionalMinutes,
      expiresAt: updatedConsultation.expiresAt,
      extendedMinutes: updatedConsultation.extendedMinutes,
      amountCharged: updatedConsultation.amountCharged,
    });
    try {
      await this.notificationsPushService.sendToUser(
        consultation.astrologerId,
        {
          title: 'Consultation extended',
          body: `Customer extended the consultation by ${additionalMinutes} minutes.`,
          data: {
            type: 'CONSULTATION_EXTENDED',
            consultationId,
            callSessionId: consultationId,
            additionalMinutes: String(additionalMinutes),
          },
        },
      );
    } catch {
      // Realtime extension must succeed even if push delivery fails.
    }

    const extensionSystemMessage = await this.prisma.chatMessage.create({
      data: {
        callSessionId: consultationId,
        senderId: userId,
        clientMessageId: `system-extension:${consultationId}:${Date.now()}`,
        messageType: ChatMessageType.SYSTEM,
        content: `Consultation extended by ${additionalMinutes} minutes`,
        isRead: false,
        readAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isAstrologer: true,
          },
        },
      },
    });

    this.chatGateway.server.to(consultationId).emit('chat:message', {
      callSessionId: consultationId,
      message: {
        id: extensionSystemMessage.id,
        callSessionId: extensionSystemMessage.callSessionId,
        senderId: extensionSystemMessage.senderId,
        clientMessageId: extensionSystemMessage.clientMessageId,
        sender: extensionSystemMessage.sender,
        messageType: extensionSystemMessage.messageType,
        content: extensionSystemMessage.content,
        attachment: null,
        isRead: extensionSystemMessage.isRead,
        readAt: extensionSystemMessage.readAt,
        createdAt: extensionSystemMessage.createdAt,
        updatedAt: extensionSystemMessage.updatedAt,
      },
    });

    return {
      success: true,
      message: 'Consultation extended successfully',

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

  async cancelConsultation(params: CancelConsultationParams) {
    const consultationId = params.consultationId?.trim();

    const requestedByUserId = params.requestedByUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!requestedByUserId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    this.ensureParticipant(consultation, requestedByUserId);

    if (consultation.endedAt) {
      throw new ConflictException('This consultation has already ended');
    }

    const normalizedStatus = consultation.status.toUpperCase();

    if (normalizedStatus !== 'PENDING') {
      throw new ConflictException(
        'Only a pending consultation request can be cancelled',
      );
    }

    const cancelledConsultation =
      await this.consultationRepository.cancelConsultation(
        consultationId,
        'CANCELLED',
      );

    this.chatGateway.server.to(consultationId).emit('consultation:cancelled', {
      consultationId,
      callSessionId: consultationId,
      status: cancelledConsultation.status,
      endedAt: cancelledConsultation.endedAt,
    });

    const otherParticipantUserId =
      requestedByUserId === consultation.userId
        ? consultation.astrologerId
        : consultation.userId;

    try {
      await this.notificationsPushService.sendToUser(otherParticipantUserId, {
        title: 'Consultation cancelled',
        body: 'The pending consultation request was cancelled.',
        data: {
          type: 'CONSULTATION_CANCELLED',
          consultationId,
          callSessionId: consultationId,
        },
      });
    } catch {
      // Cancellation must succeed even if push delivery fails.
    }

    return {
      success: true,
      message: 'Consultation cancelled successfully',
      data: cancelledConsultation,
    };
  }

  /*
   * ============================================================
   * COMPLETE CONSULTATION
   * ============================================================
   */

  async completeConsultation(params: CompleteConsultationServiceParams) {
    const consultationId = params.consultationId?.trim();

    const requestedByUserId = params.requestedByUserId?.trim();

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!requestedByUserId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    this.ensureParticipant(consultation, requestedByUserId);

    const normalizedStatus = consultation.status.toUpperCase();

    if (consultation.endedAt && normalizedStatus === 'COMPLETED') {
      const completedConsultation =
        await this.consultationRepository.findConsultationById(consultationId);

      return {
        success: true,
        message: 'Consultation is already completed',
        data: completedConsultation,
      };
    }

    if (consultation.endedAt) {
      throw new ConflictException('This consultation has already ended');
    }

    if (normalizedStatus !== 'ACTIVE') {
      throw new ConflictException(
        'Only an active consultation can be completed',
      );
    }

    /*
     * The initial wallet deduction occurs when the
     * astrologer accepts the consultation. Extensions are
     * deducted when they are purchased.
     *
     * Completion creates/updates AstrologerEarning
     * and applies the platform commission.
     */
    const platformFeePercent = await this.getPlatformFeePercent();

    const completedConsultation =
      await this.consultationRepository.completeConsultation(consultationId, {
        amountCharged: this.roundMoney(consultation.amountCharged),
        endedAt: new Date(),
        status: 'COMPLETED',
        platformFeePercent,
      });

    const endedSystemMessage = await this.prisma.chatMessage.create({
      data: {
        callSessionId: consultationId,
        senderId: requestedByUserId,
        clientMessageId: `system-ended:${consultationId}:${Date.now()}`,
        messageType: ChatMessageType.SYSTEM,
        content: 'Consultation ended',
        isRead: false,
        readAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isAstrologer: true,
          },
        },
      },
    });

    this.chatGateway.server.to(consultationId).emit('chat:message', {
      callSessionId: consultationId,
      message: {
        id: endedSystemMessage.id,
        callSessionId: endedSystemMessage.callSessionId,
        senderId: endedSystemMessage.senderId,
        clientMessageId: endedSystemMessage.clientMessageId,
        sender: endedSystemMessage.sender,
        messageType: endedSystemMessage.messageType,
        content: endedSystemMessage.content,
        attachment: null,
        isRead: endedSystemMessage.isRead,
        readAt: endedSystemMessage.readAt,
        createdAt: endedSystemMessage.createdAt,
        updatedAt: endedSystemMessage.updatedAt,
      },
    });

    this.chatGateway.server.to(consultationId).emit('chat:ended', {
      callSessionId: consultationId,
      status: 'COMPLETED',
      endedAt: new Date().toISOString(),
    });
    // #63: notify the participant who may be offline/backgrounded.
    const otherParticipantUserId =
      requestedByUserId === consultation.userId
        ? consultation.astrologerId
        : consultation.userId;

    try {
      await this.notificationsPushService.sendToUser(otherParticipantUserId, {
        title: 'Consultation ended',
        body: 'Your consultation has ended. Tap to view the chat history.',
        data: {
          type: 'CONSULTATION_ENDED',
          consultationId,
          callSessionId: consultationId,
        },
      });
    } catch {
      // Completion must succeed even if push delivery fails.
    }

    return {
      success: true,
      message: 'Consultation completed successfully',
      data: completedConsultation,
    };
  }

  /*
   * ============================================================
   * RATING AND REVIEW
   * ============================================================
   */

  async expirePendingConsultation(consultationId: string) {
    const normalizedConsultationId = consultationId?.trim();

    if (!normalizedConsultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        normalizedConsultationId,
      );

    if (consultation.endedAt) {
      return consultation;
    }

    if (consultation.status.toUpperCase() !== 'PENDING') {
      throw new ConflictException(
        'Only a pending consultation request can expire',
      );
    }

    const expiredConsultation =
      await this.consultationRepository.cancelConsultation(
        normalizedConsultationId,
        'EXPIRED',
      );

    this.chatGateway.server
      .to(normalizedConsultationId)
      .emit('consultation:expired', {
        consultationId: normalizedConsultationId,
        callSessionId: normalizedConsultationId,
        status: expiredConsultation.status,
        endedAt: expiredConsultation.endedAt,
      });

    try {
      await this.notificationsPushService.sendToUser(consultation.userId, {
        title: 'Consultation request expired',
        body: 'Your consultation request expired before it was accepted.',
        data: {
          type: 'CONSULTATION_EXPIRED',
          consultationId: normalizedConsultationId,
          callSessionId: normalizedConsultationId,
        },
      });
    } catch {
      // Expiry must succeed even if push delivery fails.
    }

    return expiredConsultation;
  }
  async rateConsultation(params: RateConsultationParams) {
    const consultationId = params.consultationId?.trim();

    const userId = params.userId?.trim();

    const rating = Math.floor(params.rating);

    if (!consultationId) {
      throw new BadRequestException('Consultation ID is required');
    }

    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const comment = params.comment?.trim();

    if (comment && comment.length > 1000) {
      throw new BadRequestException(
        'Review comment cannot exceed 1000 characters',
      );
    }

    const consultation =
      await this.consultationRepository.ensureConsultationExists(
        consultationId,
      );

    if (consultation.userId !== userId) {
      throw new ForbiddenException(
        'Only the customer can rate this consultation',
      );
    }

    if (
      !consultation.endedAt ||
      consultation.status.toUpperCase() !== 'COMPLETED'
    ) {
      throw new ConflictException(
        'The consultation must be completed before adding a rating',
      );
    }

    /*
     * CallSession.astrologerId contains User.id,
     * while Review.astrologerId requires Astrologer.id.
     */
    const astrologer = await this.consultationRepository.findAstrologerByUserId(
      consultation.astrologerId,
    );

    const alreadyReviewed =
      await this.consultationRepository.hasConsultationReview(consultationId);

    if (alreadyReviewed) {
      throw new ConflictException(
        'This consultation has already been reviewed',
      );
    }

    const review = await this.consultationRepository.createReview({
      userId,
      astrologerId: astrologer.id,
      callSessionId: consultationId,
      rating,
      comment: comment || undefined,
    });

    const ratingSummary =
      await this.consultationRepository.getAstrologerRatingSummary(
        astrologer.id,
      );

    const averageRating = Number(
      (ratingSummary._avg.rating ?? rating).toFixed(2),
    );

    const totalReviews = ratingSummary._count.id;

    await this.consultationRepository.updateAstrologerRating(
      astrologer.id,
      averageRating,
      totalReviews,
    );

    return {
      success: true,
      message: 'Consultation rated successfully',
      data: {
        review,
        astrologerRating: averageRating,
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
      consultation.userId !== requestedByUserId &&
      consultation.astrologerId !== requestedByUserId
    ) {
      throw new ForbiddenException(
        'You are not allowed to access this consultation',
      );
    }
  }

  private createChannelName() {
    return `consultation_${randomUUID().replace(/-/g, '')}`;
  }

  private addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private roundMoney(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Invalid monetary amount');
    }

    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
