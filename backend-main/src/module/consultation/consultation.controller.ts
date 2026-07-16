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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { ConsultationService } from './consultation.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
  };
};

type StartConsultationBody = {
  astrologerUserId: string;
  purchasedMinutes: number;
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
  ) {}

  /*
   * ============================================================
   * START CONSULTATION
   * ============================================================
   */

  @Post('start')
  startConsultation(
    @Req() request: AuthenticatedRequest,
    @Body() body: StartConsultationBody,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.consultationService.startConsultation({
      userId,
      astrologerUserId: body.astrologerUserId,
      purchasedMinutes: body.purchasedMinutes,
    });
  }

  /*
   * ============================================================
   * CURRENT CONSULTATION
   * ============================================================
   */

  @Get('current')
  getCurrentUserConsultation(
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.consultationService.getCurrentUserConsultation(
      userId,
    );
  }

  @Get('astrologer/current')
  getCurrentAstrologerConsultation(
    @Req() request: AuthenticatedRequest,
  ) {
    const astrologerUserId =
      this.getAuthenticatedUserId(request);

    return this.consultationService.getCurrentAstrologerConsultation(
      astrologerUserId,
    );
  }

  /*
   * ============================================================
   * CONSULTATION HISTORY
   * ============================================================
   */

  @Get('history')
  getUserConsultationHistory(
    @Req() request: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.consultationService.getUserConsultationHistory(
      userId,
      {
        page,
        limit,
      },
    );
  }

  @Get('astrologer/history')
  getAstrologerConsultationHistory(
    @Req() request: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)
    page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
  ) {
    const astrologerUserId =
      this.getAuthenticatedUserId(request);

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

  @Get(':id')
  getConsultationById(
    @Param('id') consultationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      this.getAuthenticatedUserId(request);

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
  extendConsultation(
    @Param('id') consultationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ExtendConsultationBody,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.consultationService.extendConsultation({
      consultationId,
      userId,
      additionalMinutes: body.additionalMinutes,
    });
  }

  /*
   * ============================================================
   * CANCEL CONSULTATION
   * ============================================================
   */

  @Patch(':id/cancel')
  cancelConsultation(
    @Param('id') consultationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      this.getAuthenticatedUserId(request);

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
  completeConsultation(
    @Param('id') consultationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const requestedByUserId =
      this.getAuthenticatedUserId(request);

    return this.consultationService.completeConsultation({
      consultationId,
      requestedByUserId,
    });
  }

  /*
   * ============================================================
   * RATING AND REVIEW
   * ============================================================
   */

  @Post(':id/rating')
  rateConsultation(
    @Param('id') consultationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RateConsultationBody,
  ) {
    const userId = this.getAuthenticatedUserId(request);

    return this.consultationService.rateConsultation({
      consultationId,
      userId,
      rating: body.rating,
      comment: body.comment,
    });
  }

  /*
   * ============================================================
   * AUTHENTICATION HELPER
   * ============================================================
   */

  private getAuthenticatedUserId(
    request: AuthenticatedRequest,
  ) {
    const userId = request.user?.sub ?? request.user?.id;

    if (!userId) {
      throw new Error(
        'Authenticated user ID was not found in the request',
      );
    }

    return userId;
  }
}