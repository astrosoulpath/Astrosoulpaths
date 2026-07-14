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
import { SendMessageDto } from './dto/send-message.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  /*
  ===========================================================
  JOIN CHAT
  ===========================================================
  */

  @Post('join')
  async joinChat(
    @CurrentUser() user: JWTPayload,
    @Body() dto: JoinChatDto,
  ) {
    return this.chatService.joinChat(
      user.sub as string,
      dto,
    );
  }

  /*
  ===========================================================
  SEND MESSAGE
  ===========================================================
  */

  @Post('message')
  async sendMessage(
    @CurrentUser() user: JWTPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      user.sub as string,
      dto,
    );
  }

  /*
  ===========================================================
  CHAT HISTORY
  ===========================================================
  */

  @Get(':callSessionId/history')
  async getChatHistory(
    @CurrentUser() user: JWTPayload,

    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.getChatHistory(
      user.sub as string,
      callSessionId,
    );
  }

  /*
  ===========================================================
  MARK SELECTED MESSAGES READ
  ===========================================================
  */

  @Patch('messages/read')
  async markMessagesAsRead(
    @CurrentUser() user: JWTPayload,

    @Body()
    dto: MarkMessageReadDto,
  ) {
    return this.chatService.markMessagesAsRead(
      user.sub as string,
      dto,
    );
  }

  /*
  ===========================================================
  MARK ALL READ
  ===========================================================
  */

  @Patch(':callSessionId/read-all')
  async markAllMessagesAsRead(
    @CurrentUser() user: JWTPayload,

    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.markAllMessagesAsRead(
      user.sub as string,
      callSessionId,
    );
  }

  /*
  ===========================================================
  UNREAD COUNT
  ===========================================================
  */

  @Get(':callSessionId/unread-count')
  async getUnreadCount(
    @CurrentUser() user: JWTPayload,

    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.getUnreadCount(
      user.sub as string,
      callSessionId,
    );
  }

  /*
  ===========================================================
  VERIFY CHAT ACCESS
  ===========================================================
  */

  @Get(':callSessionId/access')
  async verifyChatAccess(
    @CurrentUser() user: JWTPayload,

    @Param('callSessionId')
    callSessionId: string,
  ) {
    return this.chatService.verifyChatAccess(
      user.sub as string,
      callSessionId,
    );
  }
}