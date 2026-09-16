import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportAttachmentService } from './support-attachment.service';
import { SupportService } from './support.service';

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

function supportAttachmentFileFilter(
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  const mimeType = file.mimetype?.trim().toLowerCase();

  if (!mimeType || !SUPPORT_ATTACHMENT_MIME_TYPES.has(mimeType)) {
    callback(
      new BadRequestException(
        'Unsupported attachment type. Use JPG, PNG, WEBP, GIF, PDF, DOC, DOCX or TXT.',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller('support')
@UseGuards(SupabaseAuthGuard)
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly attachmentService: SupportAttachmentService,
  ) {}

  @Post('tickets')
  createTicket(
    @CurrentUser() user: Record<string, any>,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.createTicket(user, dto);
  }

  @Get('tickets')
  getMyTickets(@CurrentUser() user: Record<string, any>) {
    return this.supportService.getMyTickets(user);
  }

  @Get('tickets/:ticketId')
  getMyTicket(
    @CurrentUser() user: Record<string, any>,
    @Param('ticketId') ticketId: string,
  ) {
    return this.supportService.getMyTicket(user, ticketId);
  }

  @Post('tickets/:ticketId/messages')
  sendMessage(
    @CurrentUser() user: Record<string, any>,
    @Param('ticketId') ticketId: string,
    @Body() dto: SendSupportMessageDto,
  ) {
    return this.supportService.sendCustomerMessage(user, ticketId, dto);
  }

  @Patch('tickets/:ticketId/read')
  markMessagesRead(
    @CurrentUser() user: Record<string, any>,
    @Param('ticketId') ticketId: string,
  ) {
    return this.supportService.markAdminMessagesRead(user, ticketId);
  }

  @Post('tickets/:ticketId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_SUPPORT_ATTACHMENT_SIZE,
        files: 1,
      },
      fileFilter: supportAttachmentFileFilter,
    }),
  )
  async uploadAttachment(
    @CurrentUser() user: Record<string, any>,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Support attachment file is required.');
    }

    const customerId =
      await this.supportService.resolveCustomerIdForAttachment(user);

    return this.attachmentService.uploadForCustomer(ticketId, customerId, file);
  }
}
