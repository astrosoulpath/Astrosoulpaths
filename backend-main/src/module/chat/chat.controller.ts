import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ChatService } from './chat.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post('join')
  joinChat(
    @CurrentUser() user: JWTPayload,
    @Body() dto: JoinChatDto,
  ) {
    return this.chatService.joinChat(
      user.sub as string,
      dto,
    );
  }

  @Post('message')
  sendMessage(
    @CurrentUser() user: JWTPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      user.sub as string,
      dto,
    );
  }

  @Get(':callSessionId/history')
  getChatHistory(
    @CurrentUser() user: JWTPayload,
    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.getChatHistory(
      user.sub as string,
      callSessionId,
    );
  }

  @Patch('messages/read')
  markMessagesAsRead(
    @CurrentUser() user: JWTPayload,
    @Body() dto: MarkMessageReadDto,
  ) {
    return this.chatService.markMessagesAsRead(
      user.sub as string,
      dto,
    );
  }

  @Patch(':callSessionId/read-all')
  markAllMessagesAsRead(
    @CurrentUser() user: JWTPayload,
    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.markAllMessagesAsRead(
      user.sub as string,
      callSessionId,
    );
  }

  @Get(':callSessionId/unread-count')
  getUnreadCount(
    @CurrentUser() user: JWTPayload,
    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.getUnreadCount(
      user.sub as string,
      callSessionId,
    );
  }
}