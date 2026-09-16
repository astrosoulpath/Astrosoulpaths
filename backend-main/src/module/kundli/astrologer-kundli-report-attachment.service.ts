import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

const DEFAULT_KUNDLI_REPORT_BUCKET = 'kundli-reports';
const SIGNED_URL_SECONDS = 60 * 10;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

@Injectable()
export class AstrologerKundliReportAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private get bucket(): string {
    return (
      process.env.KUNDLI_REPORTS_BUCKET?.trim() || DEFAULT_KUNDLI_REPORT_BUCKET
    );
  }

  private async requireReport(reportId: string) {
    const normalizedReportId = reportId?.trim();

    if (!normalizedReportId) {
      throw new BadRequestException('Kundli report ID is required.');
    }

    const report = await this.prisma.astrologerKundliReport.findUnique({
      where: {
        id: normalizedReportId,
      },
      select: {
        id: true,
        status: true,
        astrologerId: true,
        customerUserId: true,
        callSessionId: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Professional Kundli report not found.');
    }

    return report;
  }

  private async requireAstrologerDraftOwner(
    reportId: string,
    authenticatedUserId: string,
  ) {
    const report = await this.requireReport(reportId);

    if (report.astrologerId !== authenticatedUserId) {
      throw new ForbiddenException(
        'You cannot modify another astrologer Kundli report.',
      );
    }

    if (report.status !== 'DRAFT') {
      throw new ConflictException(
        'Attachments cannot be changed after the report is finalized.',
      );
    }

    return report;
  }

  private safeExtension(originalName: string, mimeType: string): string {
    const raw = extname(originalName || '').toLowerCase();

    if (raw === '.pdf' || raw === '.jpg' || raw === '.jpeg' || raw === '.png') {
      return raw === '.jpeg' ? '.jpg' : raw;
    }

    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      default:
        return '';
    }
  }

  private safeFileName(value: string): string {
    const normalized = value
      .replace(/[^\p{L}\p{N}._ -]+/gu, '_')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized || 'kundli-report-file';
  }

  private async signedUrl(storagePath: string): Promise<string> {
    const client = this.supabaseService.getStorageClient();

    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);

    if (error || !data?.signedUrl?.trim()) {
      throw new InternalServerErrorException(
        'Unable to open Kundli report attachment.',
      );
    }

    return data.signedUrl.trim();
  }

  async upload(params: {
    reportId: string;
    authenticatedUserId: string;
    file: Express.Multer.File | undefined;
  }) {
    const report = await this.requireAstrologerDraftOwner(
      params.reportId,
      params.authenticatedUserId,
    );

    const file = params.file;

    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Kundli report attachment file is required.',
      );
    }

    const mimeType = file.mimetype?.trim().toLowerCase();

    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        'Only PDF, JPG and PNG Kundli report files are supported.',
      );
    }

    const fileName = this.safeFileName(file.originalname);
    const extension = this.safeExtension(fileName, mimeType);

    if (!extension) {
      throw new BadRequestException(
        'Unable to determine Kundli report file type.',
      );
    }

    const storagePath =
      `${report.astrologerId}/${report.customerUserId}/` +
      `${report.id}/${randomUUID()}${extension}`;

    const client = this.supabaseService.getStorageClient();

    const { error: uploadError } = await client.storage
      .from(this.bucket)
      .upload(storagePath, file.buffer, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new InternalServerErrorException(
        'Unable to upload Kundli report attachment.',
      );
    }

    try {
      const attachment =
        await this.prisma.astrologerKundliReportAttachment.create({
          data: {
            reportId: report.id,
            storagePath,
            storageUrl: `storage://${this.bucket}/${storagePath}`,
            fileName,
            mimeType,
            sizeBytes: file.size,
          },
        });

      return {
        ...attachment,
        storageUrl: await this.signedUrl(storagePath),
      };
    } catch (error) {
      await client.storage
        .from(this.bucket)
        .remove([storagePath])
        .catch(() => undefined);

      throw error;
    }
  }

  async listForAuthenticatedUser(params: {
    reportId: string;
    authenticatedUserId: string;
  }) {
    const report = await this.requireReport(params.reportId);

    const isAstrologerOwner =
      report.astrologerId === params.authenticatedUserId;

    const isCustomerOwner =
      report.customerUserId === params.authenticatedUserId;

    if (!isAstrologerOwner && !isCustomerOwner) {
      throw new ForbiddenException('You cannot access this Kundli report.');
    }

    if (isCustomerOwner && report.status !== 'FINAL') {
      throw new ForbiddenException(
        'This Kundli report is not available to the customer yet.',
      );
    }

    const attachments =
      await this.prisma.astrologerKundliReportAttachment.findMany({
        where: {
          reportId: report.id,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    return Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        storageUrl: attachment.storagePath
          ? await this.signedUrl(attachment.storagePath)
          : attachment.storageUrl,
      })),
    );
  }

  async remove(params: {
    reportId: string;
    attachmentId: string;
    authenticatedUserId: string;
  }) {
    const report = await this.requireAstrologerDraftOwner(
      params.reportId,
      params.authenticatedUserId,
    );

    const attachment =
      await this.prisma.astrologerKundliReportAttachment.findFirst({
        where: {
          id: params.attachmentId,
          reportId: report.id,
        },
      });

    if (!attachment) {
      throw new NotFoundException('Kundli report attachment not found.');
    }

    await this.prisma.astrologerKundliReportAttachment.delete({
      where: {
        id: attachment.id,
      },
    });

    if (attachment.storagePath) {
      await this.supabaseService
        .getStorageClient()
        .storage.from(this.bucket)
        .remove([attachment.storagePath])
        .catch(() => undefined);
    }

    return {
      success: true,
      attachmentId: attachment.id,
    };
  }
}
