import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologerKundliReportPdfService } from './astrologer-kundli-report-pdf.service';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';

@Controller('kundli/manual-reports')
@UseGuards(SupabaseAuthGuard)
export class AstrologerKundliReportPdfController {
  constructor(
    private readonly manualReportService: AstrologerKundliReportService,
    private readonly manualPdfService: AstrologerKundliReportPdfService,
  ) {}

  @Get(':reportId/pdf')
  async downloadPdf(
    @CurrentUser() user: JWTPayload,
    @Param('reportId') reportId: string,
    @Res({ passthrough: true })
    response: Response,
  ): Promise<StreamableFile> {
    const subject = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!subject) {
      throw new UnauthorizedException('Authenticated user is required.');
    }

    const authenticatedUserId =
      await this.manualReportService.resolveAuthenticatedUserId(subject);

    const pdf = await this.manualPdfService.generateForAuthenticatedUser({
      reportId,
      authenticatedUserId,
    });

    const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

    const fileName = `astrologer-kundli-report-${safeReportId || 'report'}.pdf`;

    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(pdf);
  }
}
