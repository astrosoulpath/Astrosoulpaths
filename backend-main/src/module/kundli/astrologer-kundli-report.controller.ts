import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';
import { UpdateAstrologerKundliReportDto } from './dto/update-astrologer-kundli-report.dto';
import { KundliSubscriptionGuard } from './guards/kundli-subscription.guard';

type ManualKundliAccess = {
  userId: string;
  astrologerId: string;
  subscriptionId: string;
  planName: string;
};

type ManualKundliRequest = Request & {
  kundliAccess?: ManualKundliAccess;
};

@Controller('kundli/manual-reports')
@UseGuards(SupabaseAuthGuard)
export class AstrologerKundliReportController {
  constructor(
    private readonly manualReportService: AstrologerKundliReportService,
  ) {}

  private getAccess(request: ManualKundliRequest): ManualKundliAccess {
    if (!request.kundliAccess) {
      throw new UnauthorizedException({
        success: false,
        code: 'KUNDLI_ACCESS_CONTEXT_MISSING',
        message: 'Kundli access context is missing',
      });
    }

    return request.kundliAccess;
  }

  /**
   * Create the single canonical DRAFT for a consultation,
   * or return the existing report.
   *
   * Customer/astrologer IDs are derived by the backend.
   */
  @Post('consultations/:callSessionId/draft')
  @UseGuards(KundliSubscriptionGuard)
  async createOrGetDraft(
    @Req() request: ManualKundliRequest,
    @Param('callSessionId') callSessionId: string,
  ) {
    const access = this.getAccess(request);

    const report = await this.manualReportService.createOrGetDraft(
      callSessionId,
      access.userId,
    );

    return {
      success: true,
      data: report,
    };
  }

  /**
   * Only an owning astrologer can edit an existing DRAFT.
   */
  @Patch(':reportId')
  @UseGuards(KundliSubscriptionGuard)
  async updateDraft(
    @Req() request: ManualKundliRequest,
    @Param('reportId') reportId: string,
    @Body() body: UpdateAstrologerKundliReportDto,
  ) {
    const access = this.getAccess(request);

    const report = await this.manualReportService.updateDraft(
      reportId,
      access.userId,
      body,
    );

    return {
      success: true,
      data: report,
    };
  }

  /**
   * FINAL reports become immutable through normal editing.
   */
  @Post(':reportId/finalize')
  @UseGuards(KundliSubscriptionGuard)
  async finalize(
    @Req() request: ManualKundliRequest,
    @Param('reportId') reportId: string,
  ) {
    const access = this.getAccess(request);

    const report = await this.manualReportService.finalize(
      reportId,
      access.userId,
    );

    return {
      success: true,
      message: 'Professional Kundli report finalized successfully',
      data: report,
    };
  }

  /**
   * Authenticated subscribed astrologer sees only own reports.
   */
  @Get('astrologer')
  @UseGuards(KundliSubscriptionGuard)
  async listForAstrologer(@Req() request: ManualKundliRequest) {
    const access = this.getAccess(request);

    const reports = await this.manualReportService.listForAstrologer(
      access.userId,
    );

    return {
      success: true,
      data: reports,
    };
  }

  /**
   * Customer endpoint does NOT require astrologer subscription.
   * Supabase subject is resolved to the canonical internal User.id.
   *
   * Service query exposes FINAL reports only.
   */
  @Get('customer/final')
  async listFinalForCustomer(@CurrentUser() user: JWTPayload) {
    const subject = typeof user?.sub === 'string' ? user.sub.trim() : '';

    const customerUserId =
      await this.manualReportService.resolveAuthenticatedUserId(subject);

    const reports =
      await this.manualReportService.listFinalForCustomer(customerUserId);

    return {
      success: true,
      data: reports,
    };
  }
}
