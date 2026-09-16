import {
  BadRequestException,
  Body,
  Controller,
  Get,
  GoneException,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Gender } from '@prisma/client';
import type { Request, Response } from 'express';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AstroParams } from '../../common/types/astro-params.type';
import type { JWTPayload } from 'jose';

import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';

import { GenerateKundliDto } from './dto/generate-kundli.dto';
import { KundliSubscriptionGuard } from './guards/kundli-subscription.guard';
import { KundliPdfService } from './kundli-pdf.service';
import { KundliSavedRecordService } from './kundli-saved-record.service';
import { KundliService } from './kundli.service';

type KundliReport = Record<string, any>;

type KundliAccessContext = {
  userId: string;
  astrologerId: string;
  subscriptionId: string;
  planName: string;
};

type KundliAuthenticatedRequest = Request & {
  kundliAccess?: KundliAccessContext;
};

@Controller('kundli')
@UseGuards(SupabaseAuthGuard)
export class KundliController {
  constructor(
    private readonly kundliService: KundliService,
    private readonly kundliSavedRecordService: KundliSavedRecordService,
    private readonly kundliPdfService: KundliPdfService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationsPushService: NotificationsPushService,
  ) {}

  @Get('my-kundli')
  async getMyKundli(@CurrentUser() user: JWTPayload) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const result = await this.kundliService.generateMyKundli(
      supabaseUserId,
      'en',
    );

    return {
      success: true,
      message: 'Customer Kundli generated successfully',
      data: result,
    };
  }
  @Get('my-kundli/pdf')
  async downloadMyKundliPdf(
    @CurrentUser() user: JWTPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const result = await this.kundliService.generateMyKundli(
      supabaseUserId,
      'en',
    );

    const pdf = await this.kundliPdfService.generateProfileKundliPdf({
      profileId: result.profile.profileId,
      kundliId: result.kundli.id,
      name: result.profile.name,
      gender: result.profile.gender,
      birthPlace: result.profile.birthPlace || 'Not available',
      dob: result.profile.dob,
      tob: result.profile.tob,
      latitude: result.profile.lat,
      longitude: result.profile.lon,
      timezone: result.profile.timezone,
      lang: 'en',
      report: result.report as KundliReport,
    });

    const fileName = `kundli-${result.userId}.pdf`;

    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdf.length.toString(),
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(pdf);
  }
  private async sendKundliReadyNotification(params: {
    userId: string;
    kundliId: string;
    savedRecordId: string;
  }): Promise<void> {
    try {
      const notification = await this.notificationsService.createForUser({
        userId: params.userId,
        title: 'Your Kundli is ready',
        body: 'Your Kundli has been generated successfully and is ready to view.',
        type: 'kundli',
        data: {
          type: 'kundli',
          kundliId: params.kundliId,
          savedRecordId: params.savedRecordId,
        },
      });

      await this.notificationsPushService.sendToUser(params.userId, {
        title: 'Your Kundli is ready',
        body: 'Your Kundli has been generated successfully and is ready to view.',
        data: {
          type: 'kundli',
          kundliId: params.kundliId,
          savedRecordId: params.savedRecordId,
          notificationId: notification.id,
        },
      });
    } catch {
      // Kundli generation must stay successful even if notification
      // persistence or FCM delivery is temporarily unavailable.
    }
  }

  /**
   * LEGACY ASTROLOGER PROVIDER ROUTE - RETIRED
   *
   * Customer AI Kundli remains provider-backed through /kundli/my-kundli.
   * Astrologers now prepare consultation reports manually through
   * /kundli/manual-reports.
   *
   * Keeping this explicit 410 response prevents old Flutter builds from
   * silently consuming paid provider credits.
   */
  @Post('generate')
  @UseGuards(KundliSubscriptionGuard)
  async generate() {
    throw new GoneException({
      success: false,
      code: 'ASTROLOGER_PROVIDER_KUNDLI_RETIRED',
      message:
        'Astrologer Kundli generation has moved to the manual professional report workflow.',
      replacement: '/kundli/manual-reports',
    });
  }

  /**
   * LEGACY PROVIDER REGENERATION - RETIRED
   *
   * Existing saved reports remain readable/downloadable.
   * Regeneration is disabled because it would perform a new astrology
   * provider calculation from the astrologer portal.
   */
  @Post('saved/:savedRecordId/regenerate')
  @UseGuards(KundliSubscriptionGuard)
  async regenerateSavedKundli() {
    throw new GoneException({
      success: false,
      code: 'ASTROLOGER_PROVIDER_REGENERATION_RETIRED',
      message:
        'Provider regeneration is no longer available from the astrologer workflow. Use the manual professional report workflow.',
      replacement: '/kundli/manual-reports',
    });
  }
  @Get('saved')
  @UseGuards(KundliSubscriptionGuard)
  async getSavedKundlis(@Req() request: KundliAuthenticatedRequest) {
    const access = this.getKundliAccess(request);

    const records = await this.kundliSavedRecordService.findForAstrologer(
      access.astrologerId,
    );

    return {
      success: true,
      data: records,
    };
  }

  @Get('saved/:savedRecordId')
  @UseGuards(KundliSubscriptionGuard)
  async getSavedKundli(
    @Req() request: KundliAuthenticatedRequest,
    @Param('savedRecordId')
    savedRecordId: string,
  ) {
    const access = this.getKundliAccess(request);

    const record = await this.kundliSavedRecordService.findOneForAstrologer(
      savedRecordId,
      access.astrologerId,
    );

    return {
      success: true,
      data: record,
    };
  }

  @Get('saved/:savedRecordId/pdf')
  @UseGuards(KundliSubscriptionGuard)
  async downloadSavedKundliPdf(
    @Req() request: KundliAuthenticatedRequest,

    @Param('savedRecordId')
    savedRecordId: string,

    @Res({
      passthrough: true,
    })
    response: Response,
  ): Promise<StreamableFile> {
    const access = this.getKundliAccess(request);

    const record = await this.kundliSavedRecordService.findOneForAstrologer(
      savedRecordId,
      access.astrologerId,
    );

    const pdf = await this.kundliPdfService.generateSavedKundliPdf({
      savedRecordId: record.id,
      kundliId: record.kundliId,

      name: record.name,
      gender: record.gender ?? 'NOT_SPECIFIED',

      birthPlace: record.birthPlace ?? 'Not available',

      dob: record.kundli.dob,
      tob: record.kundli.tob,

      latitude: record.kundli.latitude,

      longitude: record.kundli.longitude,

      timezone: record.kundli.timezone,

      lang: record.lang,

      report: record.report as KundliReport,
    });

    const fileName = `kundli-${record.id}.pdf`;

    response.set({
      'Content-Type': 'application/pdf',

      'Content-Disposition': `attachment; filename="${fileName}"`,

      'Content-Length': String(pdf.length),

      'Cache-Control': 'private, no-store, max-age=0',

      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(pdf);
  }

  private getKundliAccess(
    request: KundliAuthenticatedRequest,
  ): KundliAccessContext {
    if (!request.kundliAccess) {
      throw new UnauthorizedException({
        success: false,
        code: 'KUNDLI_ACCESS_CONTEXT_MISSING',
        message: 'Kundli access context is missing',
      });
    }

    return request.kundliAccess;
  }

  @Post('category-ai/ask')
  async askMyKundliCategory(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      category?: string;
      question?: string;
      lang?: string;
    },
  ) {
    const supabaseUserId = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!supabaseUserId) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    const category = body?.category?.trim() ?? '';
    const question = body?.question?.trim() ?? '';
    const lang = body?.lang?.trim() || 'en';

    const allowedCategories = new Set([
      'career',
      'marriage',
      'love',
      'relationship',
      'stock_market',
      'stockmarket',
      'stock-market',
      'stock market',
      'today',
      'business',
    ]);

    if (!category) {
      throw new BadRequestException('Category is required');
    }

    if (!allowedCategories.has(category.toLowerCase())) {
      throw new BadRequestException('Unsupported Kundli AI category');
    }

    if (!question) {
      throw new BadRequestException('Question is required');
    }

    if (question.length > 1200) {
      throw new BadRequestException('Question must not exceed 1200 characters');
    }

    const result = await this.kundliService.askMyKundliCategory(
      supabaseUserId,
      category,
      question,
      lang,
    );

    return {
      success: true,
      message: 'Personalized guidance generated successfully',
      ...result,
    };
  }
}
