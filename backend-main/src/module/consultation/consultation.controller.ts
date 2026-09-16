import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { UserService } from '../user/user.service';

import { ConsultationService } from './consultation.service';

type AuthenticatedRequest = Request & {
  user?: {
    /**
     * Supabase JWT subject.
     *
     * In production this is the Supabase user ID.
     * In local development our auth guard follows
     * the same contract.
     */
    sub?: string;

    /**
     * Optional compatibility field.
     */
    id?: string;
  };
};

type ConsultationMode = 'chat' | 'audio' | 'video';

type StartConsultationBody = {
  /**
   * IMPORTANT:
   *
   * This is the INTERNAL User.id of the astrologer,
   * not Astrologer.id and not Supabase ID.
   */
  astrologerUserId: string;

  purchasedMinutes: number;

  mode: ConsultationMode;
};

type ExtendConsultationBody = {
  additionalMinutes: number;
};

type RateConsultationBody = {
  rating: number;
  comment?: string;
};

@Controller('consultations')
@UseGuards(SupabaseAuthGuard)
export class ConsultationController {
  constructor(
    private readonly consultationService: ConsultationService,
    private readonly userService: UserService,
  ) {}

  /*
   * ============================================================
   * START CONSULTATION
   * ============================================================
   */

  @Post('start')
  async startConsultation(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    body: StartConsultationBody,
  ) {
    const userId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.startConsultation({
      userId,

      astrologerUserId: body.astrologerUserId,

      purchasedMinutes: body.purchasedMinutes,

      mode: body.mode,
    });
  }

  /*
   * ============================================================
   * CURRENT CUSTOMER CONSULTATION
   * ============================================================
   */

  @Get('current')
  async getCurrentUserConsultation(
    @Req()
    request: AuthenticatedRequest,
  ) {
    const userId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getCurrentUserConsultation(userId);
  }

  /*
   * ============================================================
   * CURRENT ASTROLOGER CONSULTATION
   * ============================================================
   */

  @Get('astrologer/current')
  async getCurrentAstrologerConsultation(
    @Req()
    request: AuthenticatedRequest,
  ) {
    const astrologerUserId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getCurrentAstrologerConsultation(
      astrologerUserId,
    );
  }

  /*
   * ============================================================
   * CUSTOMER CONSULTATION HISTORY
   * ============================================================
   */

  @Get('history')
  async getUserConsultationHistory(
    @Req()
    request: AuthenticatedRequest,

    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    const userId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getUserConsultationHistory(userId, {
      page,
      limit,
    });
  }

  /*
   * ============================================================
   * ASTROLOGER CONSULTATION HISTORY
   * ============================================================
   */

  @Get('astrologer/history')
  async getAstrologerConsultationHistory(
    @Req()
    request: AuthenticatedRequest,

    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,

    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    const astrologerUserId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getAstrologerConsultationHistory(
      astrologerUserId,
      {
        page,
        limit,
      },
    );
  }

  /*
   * ============================================================
   * CONSULTATION DETAILS
   * ============================================================
   */

  @Get(':id/queue-position')
  async getConsultationQueuePosition(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getConsultationQueuePosition(
      consultationId,
      requestedByUserId,
    );
  }
  @Get(':id')
  async getConsultationById(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.getConsultationById(
      consultationId,
      requestedByUserId,
    );
  }

  /*
   * ============================================================
   * EXTEND CONSULTATION
   * ============================================================
   */

  @Patch(':id/extend')
  async extendConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,

    @Body()
    body: ExtendConsultationBody,
  ) {
    const userId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.extendConsultation({
      consultationId,

      userId,

      additionalMinutes: body.additionalMinutes,
    });
  }

  /*
   * ============================================================
   * ACCEPT CONSULTATION
   * ============================================================
   */

  @Patch(':id/accept')
  async acceptConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const astrologerUserId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.acceptConsultation({
      consultationId,
      astrologerUserId,
    });
  }

  /*
   * ============================================================
   * REJECT CONSULTATION
   * ============================================================
   */

  @Patch(':id/reject')
  async rejectConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const astrologerUserId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.rejectConsultation({
      consultationId,
      astrologerUserId,
    });
  }

  /*
   * ============================================================
   * CANCEL CONSULTATION
   * ============================================================
   */

  @Patch(':id/cancel')
  async cancelConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.cancelConsultation({
      consultationId,
      requestedByUserId,
    });
  }

  /*
   * ============================================================
   * COMPLETE CONSULTATION
   * ============================================================
   */

  @Patch(':id/complete')
  async completeConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.completeConsultation({
      consultationId,
      requestedByUserId,
    });
  }

  /*
   * ============================================================
   * RATING / REVIEW
   * ============================================================
   */

  @Post(':id/rating')
  async rateConsultation(
    @Param('id')
    consultationId: string,

    @Req()
    request: AuthenticatedRequest,

    @Body()
    body: RateConsultationBody,
  ) {
    const userId = await this.getAuthenticatedInternalUserId(request);

    return this.consultationService.rateConsultation({
      consultationId,

      userId,

      rating: body.rating,

      comment: body.comment,
    });
  }

  /*
   * ============================================================
   * AUTHENTICATED INTERNAL USER RESOLUTION
   * ============================================================
   *
   * Auth provider identity:
   *
   * Supabase JWT/local token
   *          ↓
   * request.user.sub
   *          ↓
   * User.supabaseId
   *          ↓
   * canonical database User.id
   *
   * Business tables such as:
   *
   * CallSession.userId
   * CallSession.astrologerId
   * Wallet.userId
   * Chat participants
   *
   * should work with internal User.id.
   */

  private async getAuthenticatedInternalUserId(
    request: AuthenticatedRequest,
  ): Promise<string> {
    const externalUserId = request.user?.sub ?? request.user?.id;

    if (
      !externalUserId ||
      typeof externalUserId !== 'string' ||
      !externalUserId.trim()
    ) {
      throw new UnauthorizedException(
        'Authenticated user identity was not found',
      );
    }

    const normalizedExternalUserId = externalUserId.trim();

    /*
     * Supabase/local authentication provides
     * the external Supabase-style identity.
     *
     * Resolve it to the canonical internal
     * database User.id before any business logic.
     */
    const user = await this.userService.findBySupabaseId(
      normalizedExternalUserId,
    );

    if (!user?.id) {
      throw new UnauthorizedException(
        'Authenticated user account was not found',
      );
    }

    return user.id;
  }
}
