import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatMessage,
  ChatMessageType,
  Prisma,
  User,
} from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

const ACTIVE_CALL_STATUS = 'ACTIVE';
const MAX_HISTORY_MESSAGES = 200;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

type AuthenticatedUser = Pick<
  User,
  | 'id'
  | 'supabaseId'
  | 'name'
  | 'avatarUrl'
  | 'isAstrologer'
  | 'isActive'
  | 'isBlocked'
>;

type ChatMessageWithSender =
  Prisma.ChatMessageGetPayload<{
    include: {
      sender: {
        select: {
          id: true;
          name: true;
          avatarUrl: true;
          isAstrologer: true;
        };
      };
    };
  }>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private normalizeRequiredValue(
    value: string,
    fieldName: string,
  ): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(
        `${fieldName} is required`,
      );
    }

    return normalized;
  }

  private async getAuthenticatedUser(
    supabaseId: string,
  ): Promise<AuthenticatedUser> {
    const normalizedSupabaseId =
      this.normalizeRequiredValue(
        supabaseId,
        'Authenticated user ID',
      );

    const user =
      await this.prisma.user.findUnique({
        where: {
          supabaseId:
            normalizedSupabaseId,
        },
        select: {
          id: true,
          supabaseId: true,
          name: true,
          avatarUrl: true,
          isAstrologer: true,
          isActive: true,
          isBlocked: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User account was not found',
      );
    }

    if (
      !user.isActive ||
      user.isBlocked
    ) {
      throw new ForbiddenException(
        'User account is not active',
      );
    }

    return user;
  }

  private async getAccessibleCallSession(
    userId: string,
    callSessionId: string,
  ) {
    const normalizedCallSessionId =
      this.normalizeRequiredValue(
        callSessionId,
        'Call session ID',
      );

    const callSession =
      await this.prisma.callSession.findUnique({
        where: {
          id: normalizedCallSessionId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isAstrologer: true,
            },
          },
          astrologer: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isAstrologer: true,
            },
          },
        },
      });

    if (!callSession) {
      throw new NotFoundException(
        'Consultation session was not found',
      );
    }

    const hasAccess =
      callSession.userId === userId ||
      callSession.astrologerId === userId;

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this consultation chat',
      );
    }

    return callSession;
  }

  private assertCallIsActive(
    callSession: {
      status: string;
      endedAt: Date | null;
      expiresAt: Date;
    },
  ): void {
    if (
      callSession.status !==
        ACTIVE_CALL_STATUS ||
      callSession.endedAt
    ) {
      throw new BadRequestException(
        'This consultation has ended',
      );
    }

    if (
      callSession.expiresAt.getTime() <=
      Date.now()
    ) {
      throw new BadRequestException(
        'This consultation has expired',
      );
    }
  }

  private validateMessagePayload(
    dto: SendMessageDto,
  ): void {
    const messageType =
      dto.messageType ??
      ChatMessageType.TEXT;

    const content =
      dto.content?.trim();

    if (
      messageType ===
        ChatMessageType.TEXT ||
      messageType ===
        ChatMessageType.SYSTEM
    ) {
      if (!content) {
        throw new BadRequestException(
          'Message content is required',
        );
      }

      if (content.length > 4000) {
        throw new BadRequestException(
          'Message cannot exceed 4000 characters',
        );
      }
    }

    if (
      messageType ===
        ChatMessageType.IMAGE ||
      messageType ===
        ChatMessageType.FILE
    ) {
      if (
        !dto.attachmentUrl?.trim()
      ) {
        throw new BadRequestException(
          'Attachment URL is required',
        );
      }
    }

    if (
      dto.attachmentSize !==
        undefined &&
      dto.attachmentSize >
        MAX_ATTACHMENT_SIZE
    ) {
      throw new BadRequestException(
        'Attachment size cannot exceed 20 MB',
      );
    }

    if (
      dto.attachmentSize !==
        undefined &&
      dto.attachmentSize <= 0
    ) {
      throw new BadRequestException(
        'Attachment size must be greater than zero',
      );
    }
  }

  private serializeMessage(
    message: ChatMessageWithSender,
  ) {
    return {
      id: message.id,
      callSessionId:
        message.callSessionId,
      senderId: message.senderId,

      sender: {
        id: message.sender.id,
        name:
          message.sender.name ||
          'Astro Soul Path User',
        avatarUrl:
          message.sender.avatarUrl,
        isAstrologer:
          message.sender.isAstrologer,
      },

      messageType:
        message.messageType,

      content: message.content,

      attachment:
        message.attachmentUrl
          ? {
              url:
                message.attachmentUrl,
              name:
                message.attachmentName,
              mimeType:
                message.attachmentMimeType,
              size:
                message.attachmentSize,
            }
          : null,

      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  async joinChat(
    supabaseId: string,
    dto: JoinChatDto,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        dto.callSessionId,
      );

    const unreadCount =
      await this.prisma.chatMessage.count({
        where: {
          callSessionId:
            callSession.id,
          senderId: {
            not: user.id,
          },
          isRead: false,
        },
      });

    return {
      success: true,
      message:
        'Chat room joined successfully',

      data: {
        roomId: callSession.id,
        channelName:
          callSession.channelName,
        status: callSession.status,
        startedAt:
          callSession.startedAt,
        expiresAt:
          callSession.expiresAt,
        endedAt:
          callSession.endedAt,
        unreadCount,

        currentUser: {
          id: user.id,
          name:
            user.name ||
            'Astro Soul Path User',
          avatarUrl:
            user.avatarUrl,
          isAstrologer:
            user.isAstrologer,
        },

        customer:
          callSession.user,

        astrologer:
          callSession.astrologer,
      },
    };
  }

  async sendMessage(
    supabaseId: string,
    dto: SendMessageDto,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        dto.callSessionId,
      );

    this.assertCallIsActive(
      callSession,
    );

    this.validateMessagePayload(dto);

    const messageType =
      dto.messageType ??
      ChatMessageType.TEXT;

    const message =
      await this.prisma.chatMessage.create({
        data: {
          callSessionId:
            callSession.id,

          senderId: user.id,

          messageType,

          content:
            dto.content?.trim() ||
            null,

          attachmentUrl:
            dto.attachmentUrl?.trim() ||
            null,

          attachmentName:
            dto.attachmentName?.trim() ||
            null,

          attachmentMimeType:
            dto.attachmentMimeType?.trim() ||
            null,

          attachmentSize:
            dto.attachmentSize ?? null,

          isRead: false,
        },

        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isAstrologer: true,
            },
          },
        },
      });

    return {
      success: true,
      message:
        'Message sent successfully',

      data: {
        message:
          this.serializeMessage(
            message,
          ),
      },
    };
  }

  async getChatHistory(
    supabaseId: string,
    callSessionId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        callSessionId,
      );

    const newestMessages =
      await this.prisma.chatMessage.findMany({
        where: {
          callSessionId:
            callSession.id,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: MAX_HISTORY_MESSAGES,

        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              isAstrologer: true,
            },
          },
        },
      });

    const messages =
      newestMessages.reverse();

    const unreadCount =
      messages.filter(
        (message) =>
          message.senderId !==
            user.id &&
          !message.isRead,
      ).length;

    return {
      success: true,

      data: {
        callSession: {
          id: callSession.id,

          channelName:
            callSession.channelName,

          status:
            callSession.status,

          startedAt:
            callSession.startedAt,

          expiresAt:
            callSession.expiresAt,

          endedAt:
            callSession.endedAt,

          customer:
            callSession.user,

          astrologer:
            callSession.astrologer,
        },

        messages:
          messages.map((message) =>
            this.serializeMessage(
              message,
            ),
          ),

        total: messages.length,
        unreadCount,
      },
    };
  }

  async markMessagesAsRead(
    supabaseId: string,
    dto: MarkMessageReadDto,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        dto.callSessionId,
      );

    const uniqueMessageIds = [
      ...new Set(
        dto.messageIds
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];

    if (
      uniqueMessageIds.length === 0
    ) {
      throw new BadRequestException(
        'At least one message ID is required',
      );
    }

    const readAt = new Date();

    const updateResult =
      await this.prisma.chatMessage.updateMany({
        where: {
          id: {
            in: uniqueMessageIds,
          },

          callSessionId:
            callSession.id,

          senderId: {
            not: user.id,
          },

          isRead: false,
        },

        data: {
          isRead: true,
          readAt,
        },
      });

    return {
      success: true,
      message:
        'Messages marked as read',

      data: {
        callSessionId:
          callSession.id,

        messageIds:
          uniqueMessageIds,

        updatedCount:
          updateResult.count,

        readAt,
      },
    };
  }

  async markAllMessagesAsRead(
    supabaseId: string,
    callSessionId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        callSessionId,
      );

    const readAt = new Date();

    const unreadMessages =
      await this.prisma.chatMessage.findMany({
        where: {
          callSessionId:
            callSession.id,

          senderId: {
            not: user.id,
          },

          isRead: false,
        },

        select: {
          id: true,
        },
      });

    const messageIds =
      unreadMessages.map(
        (message) => message.id,
      );

    if (messageIds.length > 0) {
      await this.prisma.chatMessage.updateMany({
        where: {
          id: {
            in: messageIds,
          },
        },

        data: {
          isRead: true,
          readAt,
        },
      });
    }

    return {
      success: true,
      message:
        'All messages marked as read',

      data: {
        callSessionId:
          callSession.id,

        messageIds,

        updatedCount:
          messageIds.length,

        readAt,
      },
    };
  }

  async getUnreadCount(
    supabaseId: string,
    callSessionId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        callSessionId,
      );

    const unreadCount =
      await this.prisma.chatMessage.count({
        where: {
          callSessionId:
            callSession.id,

          senderId: {
            not: user.id,
          },

          isRead: false,
        },
      });

    return {
      success: true,

      data: {
        callSessionId:
          callSession.id,

        unreadCount,
      },
    };
  }

  async verifyChatAccess(
    supabaseId: string,
    callSessionId: string,
  ) {
    const user =
      await this.getAuthenticatedUser(
        supabaseId,
      );

    const callSession =
      await this.getAccessibleCallSession(
        user.id,
        callSessionId,
      );

    return {
      user,
      callSession,
    };
  }

  async getMessageById(
    messageId: string,
  ): Promise<ChatMessage | null> {
    const normalizedMessageId =
      messageId?.trim();

    if (!normalizedMessageId) {
      return null;
    }

    return this.prisma.chatMessage.findUnique({
      where: {
        id: normalizedMessageId,
      },
    });
  }
}