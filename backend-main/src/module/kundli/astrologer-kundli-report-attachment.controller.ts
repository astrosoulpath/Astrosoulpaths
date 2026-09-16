import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { KundliSubscriptionGuard } from './guards/kundli-subscription.guard';
import { AstrologerKundliReportService } from './astrologer-kundli-report.service';
import { AstrologerKundliReportAttachmentService } from './astrologer-kundli-report-attachment.service';

const MAX_KUNDLI_REPORT_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const KUNDLI_REPORT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

function kundliReportAttachmentFileFilter(
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  const mimeType = file.mimetype?.trim().toLowerCase();

  if (!mimeType || !KUNDLI_REPORT_MIME_TYPES.has(mimeType)) {
    callback(
      new BadRequestException(
        'Only PDF, JPG and PNG Kundli report files are supported.',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller('kundli/manual-reports')
@UseGuards(SupabaseAuthGuard)
export class AstrologerKundliReportAttachmentController {
  constructor(
    private readonly reportService: AstrologerKundliReportService,
    private readonly attachmentService: AstrologerKundliReportAttachmentService,
  ) {}

  private async authenticatedUserId(
    user: Record<string, any>,
  ): Promise<string> {
    return this.reportService.resolveAuthenticatedUserId(
      user?.sub?.toString() ?? '',
    );
  }

  @Post(':reportId/attachments')
  @UseGuards(KundliSubscriptionGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_KUNDLI_REPORT_ATTACHMENT_SIZE,
        files: 1,
      },
      fileFilter: kundliReportAttachmentFileFilter,
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: Record<string, any>,
    @Param('reportId') reportId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const authenticatedUserId = await this.authenticatedUserId(user);

    const attachment = await this.attachmentService.upload({
      reportId,
      authenticatedUserId,
      file,
    });

    return {
      success: true,
      data: attachment,
    };
  }

  @Get(':reportId/attachments')
  async listAttachments(
    @CurrentUser() user: Record<string, any>,
    @Param('reportId') reportId: string,
  ) {
    const authenticatedUserId = await this.authenticatedUserId(user);

    const attachments = await this.attachmentService.listForAuthenticatedUser({
      reportId,
      authenticatedUserId,
    });

    return {
      success: true,
      data: attachments,
    };
  }

  @Delete(':reportId/attachments/:attachmentId')
  @UseGuards(KundliSubscriptionGuard)
  async deleteAttachment(
    @CurrentUser() user: Record<string, any>,
    @Param('reportId') reportId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const authenticatedUserId = await this.authenticatedUserId(user);

    return this.attachmentService.remove({
      reportId,
      attachmentId,
      authenticatedUserId,
    });
  }
}
