import {
  Body,
  Controller,
  Delete,
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
import { ChatGateway } from './chat.gateway';

import { JoinChatDto } from './dto/join-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RegisterChatEncryptionDeviceDto } from './dto/register-chat-encryption-device.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { BlockChatUserDto, ReportChatUserDto } from './dto/chat-safety.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /*
  ===========================================================
  JOIN CHAT
  ===========================================================
  */

  /*
  ===========================================================
  E2EE DEVICE IDENTITY
  ===========================================================
  */

  @Post('e2ee/device')
  async registerEncryptionDevice(
    @CurrentUser() user: JWTPayload,
    @Body() dto: RegisterChatEncryptionDeviceDto,
  ) {
    return this.chatService.registerEncryptionDevice(user.sub as string, dto);
  }

  @Get('e2ee/:callSessionId/participants')
  async getEncryptionParticipants(
    @CurrentUser() user: JWTPayload,
    @Param('callSessionId') callSessionId: string,
  ) {
    return this.chatService.getEncryptionParticipants(
      user.sub as string,
      callSessionId,
    );
  }
  @Post('join')
  async joinChat(@CurrentUser() user: JWTPayload, @Body() dto: JoinChatDto) {
    return this.chatService.joinChat(user.sub as string, dto);
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
    const result = await this.chatService.sendMessage(user.sub as string, dto);

    if (!result.data.duplicate) {
      this.chatGateway.server
        .to(dto.callSessionId)
        .emit('chat:message', result.data.message);
    }

    return result;
  }

  /*
  ===========================================================
  CHAT SAFETY / MODERATION
  ===========================================================
  */

  @Post('safety/block')
  async blockUser(
    @CurrentUser() user: JWTPayload,
    @Body() dto: BlockChatUserDto,
  ) {
    return this.chatService.blockUser(user.sub as string, dto.userId);
  }

  @Delete('safety/block/:userId')
  async unblockUser(
    @CurrentUser() user: JWTPayload,
    @Param('userId') userId: string,
  ) {
    return this.chatService.unblockUser(user.sub as string, userId);
  }

  @Get('safety/status/:userId')
  async getSafetyStatus(
    @CurrentUser() user: JWTPayload,
    @Param('userId') userId: string,
  ) {
    return this.chatService.getSafetyStatus(user.sub as string, userId);
  }

  @Post('safety/report')
  async reportUser(
    @CurrentUser() user: JWTPayload,
    @Body() dto: ReportChatUserDto,
  ) {
    return this.chatService.reportUser(user.sub as string, dto);
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
    return this.chatService.getChatHistory(user.sub as string, callSessionId);
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
    return this.chatService.markMessagesAsRead(user.sub as string, dto);
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
    const result = await this.chatService.markAllMessagesAsRead(
      user.sub as string,
      callSessionId,
    );

    this.chatGateway.server.to(callSessionId).emit('chat:read-all', {
      ...result.data,
      success: true,
      callSessionId,
    });

    return result;
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
    return this.chatService.getUnreadCount(user.sub as string, callSessionId);
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
    return this.chatService.verifyChatAccess(user.sub as string, callSessionId);
  }
}
