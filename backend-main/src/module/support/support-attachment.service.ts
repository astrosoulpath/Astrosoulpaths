import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

const SUPPORT_BUCKET = 'support';
const MAX_SUPPORT_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const SUPPORT_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'text/plain': '.txt',
};

@Injectable()
export class SupportAttachmentService {
  private readonly logger = new Logger(SupportAttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async uploadForCustomer(
    ticketId: string,
    customerId: string,
    file: Express.Multer.File | undefined,
  ) {
    const normalizedTicketId = ticketId?.trim();

    if (!normalizedTicketId) {
      throw new BadRequestException('Support ticket ID is required.');
    }

    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Attachment file is required.');
    }

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: normalizedTicketId,
        customerId,
      },
      select: {
        id: true,
        ticketNumber: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const contentType = file.mimetype?.trim().toLowerCase();

    if (!contentType || !SUPPORT_ATTACHMENT_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported attachment type. Use JPG, PNG, WEBP, GIF, PDF, DOC, DOCX or TXT.',
      );
    }

    if (
      !Number.isFinite(file.size) ||
      file.size <= 0 ||
      file.size > MAX_SUPPORT_ATTACHMENT_SIZE
    ) {
      throw new BadRequestException(
        'Attachment must be between 1 byte and 10 MB.',
      );
    }

    const originalFileName = this.sanitizeOriginalName(file.originalname);
    const extension = this.getSafeExtension(originalFileName, contentType);

    const storagePath = `${customerId}/${ticket.id}/${randomUUID()}${extension}`;

    const storage = this.supabaseService.getStorageClient();

    const { error: uploadError } = await storage.storage
      .from(SUPPORT_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      this.logger.error(
        `Support attachment upload failed for ${ticket.ticketNumber}: ${uploadError.message}`,
      );

      throw new BadRequestException(
        `Unable to upload support attachment: ${uploadError.message}`,
      );
    }

    try {
      const attachment = await this.prisma.supportAttachment.create({
        data: {
          ticketId: ticket.id,
          storageBucket: SUPPORT_BUCKET,
          storagePath,
          originalFileName,
          contentType,
          sizeBytes: file.size,
        },
      });

      return {
        success: true,
        message: 'Support attachment uploaded successfully.',
        attachment,
      };
    } catch (error) {
      await storage.storage
        .from(SUPPORT_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);

      this.logger.error(
        `Support attachment metadata save failed for ${ticket.ticketNumber}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new InternalServerErrorException(
        'Attachment upload could not be completed.',
      );
    }
  }

  async createSignedUrl(
    storageBucket: string,
    storagePath: string,
  ): Promise<string> {
    const storage = this.supabaseService.getStorageClient();

    const { data, error } = await storage.storage
      .from(storageBucket)
      .createSignedUrl(storagePath, 60 * 10);

    if (error || !data?.signedUrl?.trim()) {
      this.logger.error(
        `Support attachment signed URL failed for ${storagePath}: ${
          error?.message ?? 'missing signed URL'
        }`,
      );

      throw new InternalServerErrorException(
        'Unable to open support attachment.',
      );
    }

    return data.signedUrl.trim();
  }

  private sanitizeOriginalName(originalName: string): string {
    const safe = originalName
      ?.trim()
      .replace(/[^\w.\- ]+/g, '')
      .replace(/\s+/g, ' ');

    return safe || 'attachment';
  }

  private getSafeExtension(originalName: string, contentType: string): string {
    const extension = extname(originalName ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');

    if (extension && extension.length <= 10) {
      return extension;
    }

    return MIME_EXTENSION_MAP[contentType] ?? '';
  }
}
