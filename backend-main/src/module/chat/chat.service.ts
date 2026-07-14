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
const MAX_TEXT_LENGTH = 2_000;
const MAX_ATTACHMENT_SIZE =
  20 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

const ALLOWED_FILE_MIME_TYPES =
  new Set([
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);

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

type ParticipantData = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  isAstrologer: boolean;
};

type AccessibleCallSession =
  Prisma.CallSessionGetPayload<{
    include: {
      user: {
        select: {
          id: true;
          name: true;
          avatarUrl: true;
          isAstrologer: true;
        };
      };

      astrologer: {
        select: {
          id: true;
          name: true;
          avatarUrl: true;
          isAstrologer: true;
        };
      };
    };
  }>;

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
    value: unknown,
    fieldName: string,
  ): string {
    if (
      typeof value !== 'string'
    ) {
      throw new BadRequestException(
        `${fieldName} is required`,
      );
    }

    const normalized =
      value.trim();

    if (!normalized) {
      throw new BadRequestException(
        `${fieldName} is required`,
      );
    }

    return normalized;
  }

  private normalizeOptionalValue(
    value: unknown,
  ): string | null {
    if (
      typeof value !== 'string'
    ) {
      return null;
    }

    const normalized =
      value.trim();

    return normalized || null;
  }

  private normalizeMessageIds(
    messageIds: unknown,
  ): string[] {
    if (
      !Array.isArray(messageIds)
    ) {
      throw new BadRequestException(
        'Message IDs are required',
      );
    }

    return [
      ...new Set(
        messageIds
          .filter(
            (
              id,
            ): id is string =>
              typeof id ===
              'string',
          )
          .map((id) =>
            id.trim(),
          )
          .filter(Boolean),
      ),
    ];
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

    if (!user.isActive) {
      throw new ForbiddenException(
        'User account is inactive',
      );
    }

    if (user.isBlocked) {
      throw new ForbiddenException(
        'User account is blocked',
      );
    }

    return user;
  }

  private async getAccessibleCallSession(
    userId: string,
    callSessionId: string,
  ): Promise<AccessibleCallSession> {
    const normalizedUserId =
      this.normalizeRequiredValue(
        userId,
        'User ID',
      );

    const normalizedCallSessionId =
      this.normalizeRequiredValue(
        callSessionId,
        'Call session ID',
      );

    const callSession =
      await this.prisma.callSession.findUnique({
        where: {
          id:
            normalizedCallSessionId,
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
      callSession.userId ===
        normalizedUserId ||
      callSession.astrologerId ===
        normalizedUserId;

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
      ACTIVE_CALL_STATUS
    ) {
      throw new BadRequestException(
        'This consultation is not active',
      );
    }

    if (callSession.endedAt) {
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

  private validateAttachmentSize(
    attachmentSize:
      | number
      | undefined,
  ): void {
    if (
      attachmentSize ===
      undefined
    ) {
      return;
    }

    if (
      !Number.isFinite(
        attachmentSize,
      )
    ) {
      throw new BadRequestException(
        'Attachment size is invalid',
      );
    }

    if (attachmentSize <= 0) {
      throw new BadRequestException(
        'Attachment size must be greater than zero',
      );
    }

    if (
      attachmentSize >
      MAX_ATTACHMENT_SIZE
    ) {
      throw new BadRequestException(
        'Attachment size cannot exceed 20 MB',
      );
    }
  }

  private validateAttachmentMimeType(
    messageType: ChatMessageType,
    attachmentMimeType:
      | string
      | undefined,
  ): void {
    if (!attachmentMimeType) {
      return;
    }

    const normalizedMimeType =
      attachmentMimeType
        .trim()
        .toLowerCase();

    if (
      messageType ===
        ChatMessageType.IMAGE &&
      !ALLOWED_IMAGE_MIME_TYPES.has(
        normalizedMimeType,
      )
    ) {
      throw new BadRequestException(
        'Unsupported image format',
      );
    }

    if (
      messageType ===
        ChatMessageType.FILE &&
      !ALLOWED_FILE_MIME_TYPES.has(
        normalizedMimeType,
      )
    ) {
      throw new BadRequestException(
        'Unsupported file format',
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

    const attachmentUrl =
      dto.attachmentUrl?.trim();

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

      if (
        content.length >
        MAX_TEXT_LENGTH
      ) {
        throw new BadRequestException(
          `Message cannot exceed ${MAX_TEXT_LENGTH} characters`,
        );
      }
    }

    if (
      messageType ===
        ChatMessageType.IMAGE ||
      messageType ===
        ChatMessageType.FILE
    ) {
      if (!attachmentUrl) {
        throw new BadRequestException(
          'Attachment URL is required',
        );
      }

      try {
        const parsedUrl =
          new URL(
            attachmentUrl,
          );

        if (
          parsedUrl.protocol !==
            'https:' &&
          parsedUrl.protocol !==
            'http:'
        ) {
          throw new Error();
        }
      } catch {
        throw new BadRequestException(
          'Attachment URL is invalid',
        );
      }

      this.validateAttachmentSize(
        dto.attachmentSize,
      );

      this.validateAttachmentMimeType(
        messageType,
        dto.attachmentMimeType,
      );
    }
  }

  private serializeParticipant(
    participant: ParticipantData,
  ) {
    return {
      id:
        participant.id,

      name:
        participant.name ||
        (participant.isAstrologer
          ? 'Astrologer'
          : 'Astro Soul Path User'),

      avatarUrl:
        participant.avatarUrl,

      isAstrologer:
        participant.isAstrologer,
    };
  }

  private serializeMessage(
    message: ChatMessageWithSender,
  ) {
    return {
      id:
        message.id,

      callSessionId:
        message.callSessionId,

      senderId:
        message.senderId,

      sender: {
        id:
          message.sender.id,

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

      content:
        message.content,

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

      isRead:
        message.isRead,

      readAt:
        message.readAt,

      createdAt:
        message.createdAt,

      updatedAt:
        message.updatedAt,
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
            not:
              user.id,
          },

          isRead:
            false,
        },
      });

    return {
      success: true,

      message:
        'Chat room joined successfully',

      data: {
        roomId:
          callSession.id,

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

        unreadCount,

        currentUser: {
          id:
            user.id,

          name:
            user.name ||
            'Astro Soul Path User',

          avatarUrl:
            user.avatarUrl,

          isAstrologer:
            user.isAstrologer,
        },

        customer:
          this.serializeParticipant(
            callSession.user,
          ),

        astrologer:
          this.serializeParticipant(
            callSession.astrologer,
          ),
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

    this.validateMessagePayload(
      dto,
    );

    const messageType =
      dto.messageType ??
      ChatMessageType.TEXT;

    const message =
      await this.prisma.chatMessage.create({
        data: {
          callSessionId:
            callSession.id,

          senderId:
            user.id,

          messageType,

          content:
            this.normalizeOptionalValue(
              dto.content,
            ),

          attachmentUrl:
            this.normalizeOptionalValue(
              dto.attachmentUrl,
            ),

          attachmentName:
            this.normalizeOptionalValue(
              dto.attachmentName,
            ),

          attachmentMimeType:
            this.normalizeOptionalValue(
              dto.attachmentMimeType,
            ),

          attachmentSize:
            dto.attachmentSize ??
            null,

          isRead:
            false,

          readAt:
            null,
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

    const [
      newestMessages,
      total,
      unreadCount,
    ] =
      await this.prisma.$transaction([
        this.prisma.chatMessage.findMany({
          where: {
            callSessionId:
              callSession.id,
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take:
            MAX_HISTORY_MESSAGES,

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
        }),

        this.prisma.chatMessage.count({
          where: {
            callSessionId:
              callSession.id,
          },
        }),

        this.prisma.chatMessage.count({
          where: {
            callSessionId:
              callSession.id,

            senderId: {
              not:
                user.id,
            },

            isRead:
              false,
          },
        }),
      ]);

    const messages =
      newestMessages.reverse();

    return {
      success: true,

      data: {
        callSession: {
          id:
            callSession.id,

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
            this.serializeParticipant(
              callSession.user,
            ),

          astrologer:
            this.serializeParticipant(
              callSession.astrologer,
            ),
        },

        messages:
          messages.map(
            (message) =>
              this.serializeMessage(
                message,
              ),
          ),

        total,
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

    const messageIds =
      this.normalizeMessageIds(
        dto.messageIds,
      );

    if (
      messageIds.length === 0
    ) {
      throw new BadRequestException(
        'At least one message ID is required',
      );
    }

    const validMessages =
      await this.prisma.chatMessage.findMany({
        where: {
          id: {
            in:
              messageIds,
          },

          callSessionId:
            callSession.id,

          senderId: {
            not:
              user.id,
          },
        },

        select: {
          id: true,
        },
      });

    const validMessageIds =
      validMessages.map(
        (message) =>
          message.id,
      );

    if (
      validMessageIds.length ===
      0
    ) {
      return {
        success: true,

        message:
          'No unread messages were found',

        data: {
          callSessionId:
            callSession.id,

          messageIds: [],

          updatedCount:
            0,

          readAt:
            new Date(),
        },
      };
    }

    const readAt =
      new Date();

    const updateResult =
      await this.prisma.chatMessage.updateMany({
        where: {
          id: {
            in:
              validMessageIds,
          },

          callSessionId:
            callSession.id,

          senderId: {
            not:
              user.id,
          },

          isRead:
            false,
        },

        data: {
          isRead:
            true,

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
          validMessageIds,

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

    const unreadMessages =
      await this.prisma.chatMessage.findMany({
        where: {
          callSessionId:
            callSession.id,

          senderId: {
            not:
              user.id,
          },

          isRead:
            false,
        },

        select: {
          id:
            true,
        },
      });

    const messageIds =
      unreadMessages.map(
        (message) =>
          message.id,
      );

    const readAt =
      new Date();

    if (
      messageIds.length >
      0
    ) {
      await this.prisma.chatMessage.updateMany({
        where: {
          id: {
            in:
              messageIds,
          },

          callSessionId:
            callSession.id,

          senderId: {
            not:
              user.id,
          },

          isRead:
            false,
        },

        data: {
          isRead:
            true,

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
            not:
              user.id,
          },

          isRead:
            false,
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
      this.normalizeOptionalValue(
        messageId,
      );

    if (!normalizedMessageId) {
      return null;
    }

    return this.prisma.chatMessage.findUnique({
      where: {
        id:
          normalizedMessageId,
      },
    });
  }
}