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
import {supportLock} from './support-policy';
import {auditSupport} from './support-operations';

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
        status:true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }
    if(ticket.status==='CLOSED')throw new BadRequestException('Closed support ticket cannot receive attachments');

    const contentType = file.mimetype?.trim().toLowerCase();

    if (!contentType || !SUPPORT_ATTACHMENT_MIME_TYPES.has(contentType)) {
      throw new BadRequestException(
        'Unsupported attachment type. Use JPG, PNG, WEBP, GIF, PDF, DOC, DOCX or TXT.',
      );
    }

    if (
      !Number.isFinite(file.size) ||
      file.size <= 0 ||
      file.size > MAX_SUPPORT_ATTACHMENT_SIZE || file.size !== file.buffer.length
    ) {
      throw new BadRequestException(
        'Attachment must be between 1 byte and 10 MB.',
      );
    }

    const originalFileName = this.sanitizeOriginalName(file.originalname);
    const bytes=file.buffer;
    const valid:Record<string,boolean>={
      'image/png':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      'image/jpeg':bytes.subarray(0,3).equals(Buffer.from([255,216,255])),
      'image/jpg':bytes.subarray(0,3).equals(Buffer.from([255,216,255])),
      'image/webp':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',
      'image/gif':/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()),
      'application/pdf':bytes.subarray(0,5).toString()==='%PDF-',
      'application/msword':bytes.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225])),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':bytes.subarray(0,4).equals(Buffer.from([80,75,3,4])),
      'text/plain':!bytes.includes(0)&&!bytes.toString('utf8').includes('\uFFFD'),
    };
    if(!valid[contentType]) throw new BadRequestException('Attachment content does not match its type');
    const extension = this.getSafeExtension(originalFileName, contentType);

    const storagePath = `${customerId}/${ticket.id}/${randomUUID()}${extension}`;

    const storage = this.supabaseService.getStorageClient();
    await this.assertPrivate(storage);

    const { error: uploadError } = await storage.storage
      .from(SUPPORT_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      this.logger.error(
        'Support attachment upload failed',
      );

      throw new BadRequestException(
        'Unable to upload support attachment.',
      );
    }

    try {
      const attachment = await this.prisma.$transaction(async tx=>{
        await supportLock(tx,'ticket:'+ticket.id);
        const current=await tx.supportTicket.findFirst({where:{id:ticket.id,customerId},select:{status:true}});
        if(!current||current.status==='CLOSED')throw new BadRequestException('Ticket is no longer open for attachments');
        const saved=await tx.supportAttachment.create({
        data: {
          ticketId: ticket.id,
          storageBucket: SUPPORT_BUCKET,
          storagePath,
          originalFileName,
          contentType,
          sizeBytes: file.size,
        },
        });
        await tx.supportTicket.update({where:{id:ticket.id},data:{lastMessageAt:new Date()}});
        await auditSupport(tx,customerId,'TICKET',ticket.id,'ATTACHMENT_ADDED',{attachmentId:saved.id});
        return saved;
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
        'SUPPORT_ATTACHMENT_SAVE_FAILED',
      );

      throw new InternalServerErrorException(
        'Attachment upload could not be completed.',
      );
    }
  }

  async createSignedUrl(
    storageBucket: string,
    storagePath: string,
    ticketId: string,
  ): Promise<string> {
    if(storageBucket!==SUPPORT_BUCKET || !ticketId || !await this.prisma.supportAttachment.findFirst({where:{ticketId,storageBucket,storagePath},select:{id:true}})) throw new NotFoundException('Support attachment not found');
    const storage = this.supabaseService.getStorageClient();
    await this.assertPrivate(storage);

    const { data, error } = await storage.storage
      .from(storageBucket)
      .createSignedUrl(storagePath, 120, {download:true});

    if (error || !data?.signedUrl?.trim()) {
      this.logger.error(
        'Support attachment signed URL failed',
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

    return MIME_EXTENSION_MAP[contentType] ?? '';
  }

  private async assertPrivate(storage:any) {
    const {data,error}=await storage.storage.getBucket(SUPPORT_BUCKET);
    if(error || data?.public!==false) throw new BadRequestException('Private support storage is required');
  }
}
