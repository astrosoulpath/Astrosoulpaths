import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessage, ChatMessageType, Prisma, User } from '@prisma/client';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RegisterChatEncryptionDeviceDto } from './dto/register-chat-encryption-device.dto';
import { ReportChatUserDto } from './dto/chat-safety.dto';

const ACTIVE_CALL_STATUS = 'ACTIVE';

const MAX_HISTORY_MESSAGES = 200;

const MAX_TEXT_LENGTH = 2_000;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
]);
const ALLOWED_FILE_MIME_TYPES = new Set([
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

type AccessibleCallSession = Prisma.CallSessionGetPayload<{
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

type ChatMessageWithSender = Prisma.ChatMessageGetPayload<{
  include: {
    sender: {
      select: {
        id: true;
        name: true;
        avatarUrl: true;
        isAstrologer: true;
      };
    };
    replyToMessage: {
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
    };
  };
}>;
@Injectable()
export class ChatService {
  /**
   * Resolve an authenticated identity to the canonical ASP User row.
   *
   * Phone OTP / Google / Supabase identities can have different auth UUIDs.
   * UserAuthIdentity is authoritative; User.supabaseId remains the legacy
   * fallback. Internal User.id is also accepted for existing internal callers.
   */
  private async resolveCanonicalChatUser(authUserId: string) {
    const normalizedAuthId = authUserId?.trim();

    if (!normalizedAuthId) {
      throw new BadRequestException('Authenticated user ID is required');
    }

    const authIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedAuthId,
        },
      },
      select: {
        userId: true,
      },
    });

    const user = authIdentity
      ? await this.prisma.user.findUnique({
          where: {
            id: authIdentity.userId,
          },
        })
      : await this.prisma.user.findFirst({
          where: {
            OR: [
              {
                supabaseId: normalizedAuthId,
              },
              {
                id: normalizedAuthId,
              },
            ],
          },
        });

    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    if (!user.isActive || user.isBlocked) {
      throw new ForbiddenException('User account is not active');
    }

    return user;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsPushService: NotificationsPushService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private normalizeRequiredValue(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }

    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private normalizeMessageIds(messageIds: unknown): string[] {
    if (!Array.isArray(messageIds)) {
      throw new BadRequestException('Message IDs are required');
    }

    return [
      ...new Set(
        messageIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
  }

  private async getAuthenticatedUser(
    supabaseId: string,
  ): Promise<AuthenticatedUser> {
    const normalizedSupabaseId = this.normalizeRequiredValue(
      supabaseId,
      'Authenticated user ID',
    );

    // Canonical identity resolution:
    // 1. UserAuthIdentity is authoritative for Supabase/auth identities.
    // 2. User.supabaseId supports legacy accounts.
    // 3. User.id supports existing trusted internal callers.
    const authIdentity = await this.prisma.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: normalizedSupabaseId,
        },
      },
      select: {
        userId: true,
      },
    });

    const user = authIdentity
      ? await this.prisma.user.findUnique({
          where: {
            id: authIdentity.userId,
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
        })
      : await this.prisma.user.findFirst({
          where: {
            OR: [
              {
                supabaseId: normalizedSupabaseId,
              },
              {
                id: normalizedSupabaseId,
              },
            ],
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
      throw new NotFoundException('User account was not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('User account is blocked');
    }

    return user;
  }
  private async getAccessibleCallSession(
    userId: string,
    callSessionId: string,
  ): Promise<AccessibleCallSession> {
    const normalizedUserId = this.normalizeRequiredValue(userId, 'User ID');

    const normalizedCallSessionId = this.normalizeRequiredValue(
      callSessionId,
      'Call session ID',
    );

    const callSession = await this.prisma.callSession.findUnique({
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
      throw new NotFoundException('Consultation session was not found');
    }

    const hasAccess =
      callSession.userId === normalizedUserId ||
      callSession.astrologerId === normalizedUserId;

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this consultation chat',
      );
    }

    return callSession;
  }

  private assertCallIsActive(callSession: {
    status: string;
    endedAt: Date | null;
    expiresAt: Date;
  }): void {
    if (callSession.status !== ACTIVE_CALL_STATUS) {
      throw new BadRequestException('This consultation is not active');
    }

    if (callSession.endedAt) {
      throw new BadRequestException('This consultation has ended');
    }

    if (callSession.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This consultation has expired');
    }
  }

  private validateAttachmentSize(attachmentSize: number | undefined): void {
    if (attachmentSize === undefined) {
      return;
    }

    if (!Number.isFinite(attachmentSize)) {
      throw new BadRequestException('Attachment size is invalid');
    }

    if (attachmentSize <= 0) {
      throw new BadRequestException(
        'Attachment size must be greater than zero',
      );
    }

    if (attachmentSize > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException('Attachment size cannot exceed 20 MB');
    }
  }

  private validateAttachmentMimeType(
    messageType: ChatMessageType,
    attachmentMimeType: string | undefined,
  ): void {
    if (!attachmentMimeType) {
      return;
    }

    const normalizedMimeType = attachmentMimeType.trim().toLowerCase();

    if (
      (messageType === ChatMessageType.IMAGE ||
        messageType === ChatMessageType.STICKER) &&
      !ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType)
    ) {
      throw new BadRequestException('Unsupported image format');
    }

    if (
      messageType === ChatMessageType.FILE &&
      !ALLOWED_FILE_MIME_TYPES.has(normalizedMimeType)
    ) {
      throw new BadRequestException('Unsupported file format');
    }

    if (
      messageType === ChatMessageType.AUDIO &&
      !ALLOWED_AUDIO_MIME_TYPES.has(normalizedMimeType)
    ) {
      throw new BadRequestException('Unsupported audio format');
    }
  }

  private validateMessagePayload(dto: SendMessageDto): void {
    const MAX_ENCRYPTED_CONTENT_LENGTH = 30000;

    const normalize = (value: unknown): string =>
      typeof value === 'string' ? value.trim() : '';

    const assertBase64 = (
      value: string,
      fieldName: string,
      expectedBytes?: number,
    ): void => {
      if (!value) {
        throw new BadRequestException(`${fieldName} is required`);
      }

      let bytes: Buffer;

      try {
        bytes = Buffer.from(value, 'base64');
      } catch {
        throw new BadRequestException(`${fieldName} is invalid`);
      }

      if (bytes.length === 0) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }

      const canonical = bytes.toString('base64').replace(/=+$/u, '');
      const supplied = value.replace(/=+$/u, '');

      if (canonical !== supplied) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }

      if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
        throw new BadRequestException(
          `${fieldName} must contain exactly ${expectedBytes} bytes`,
        );
      }
    };

    const messageType = dto.messageType ?? ChatMessageType.TEXT;

    const content = normalize(dto.content);
    const encryptedContent = normalize(dto.encryptedContent);
    const encryptionNonce = normalize(dto.encryptionNonce);
    const encryptionMac = normalize(dto.encryptionMac);
    const encryptionVersion = dto.encryptionVersion;

    const attachmentUrl = normalize(dto.attachmentUrl);

    if (messageType === ChatMessageType.TEXT) {
      if (content) {
        throw new BadRequestException(
          'Plaintext content is not allowed for secure text messages',
        );
      }

      if (!encryptedContent) {
        throw new BadRequestException('Encrypted message content is required');
      }

      if (encryptedContent.length > MAX_ENCRYPTED_CONTENT_LENGTH) {
        throw new BadRequestException('Encrypted message payload is too large');
      }

      assertBase64(encryptedContent, 'Encrypted message content');

      // AES-GCM nonce produced by the Flutter cryptography package
      // is 12 bytes.
      assertBase64(encryptionNonce, 'Encryption nonce', 12);

      // AES-GCM authentication tag is 16 bytes.
      assertBase64(encryptionMac, 'Encryption MAC', 16);

      if (encryptionVersion !== 1) {
        throw new BadRequestException('Unsupported chat encryption version');
      }
    }

    if (messageType === ChatMessageType.SYSTEM) {
      if (!content) {
        throw new BadRequestException('System message content is required');
      }

      if (content.length > MAX_TEXT_LENGTH) {
        throw new BadRequestException(
          `Message cannot exceed ${MAX_TEXT_LENGTH} characters`,
        );
      }

      if (
        encryptedContent ||
        encryptionNonce ||
        encryptionMac ||
        encryptionVersion !== undefined
      ) {
        throw new BadRequestException(
          'System messages cannot contain user E2EE payload fields',
        );
      }
    }

    if (messageType === ChatMessageType.AUDIO) {
      if (
        !Number.isInteger(dto.audioDurationMs) ||
        !dto.audioDurationMs ||
        dto.audioDurationMs < 1 ||
        dto.audioDurationMs > 10 * 60 * 1000
      ) {
        throw new BadRequestException(
          'Audio duration is required and must be between 1 ms and 10 minutes',
        );
      }
    } else if (dto.audioDurationMs != null) {
      throw new BadRequestException(
        'Audio duration is only valid for audio messages',
      );
    }
    if (
      messageType === ChatMessageType.IMAGE ||
      messageType === ChatMessageType.STICKER ||
      messageType === ChatMessageType.FILE ||
      messageType === ChatMessageType.AUDIO
    ) {
      if (!attachmentUrl) {
        throw new BadRequestException('Attachment URL is required');
      }

      try {
        const parsedUrl = new URL(attachmentUrl);

        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          throw new Error();
        }
      } catch {
        throw new BadRequestException('Attachment URL is invalid');
      }

      this.validateAttachmentSize(dto.attachmentSize);

      this.validateAttachmentMimeType(messageType, dto.attachmentMimeType);

      // Do not allow an attachment caption to silently leak
      // as plaintext. Caption encryption will use the same
      // E2EE metadata fields.
      if (content) {
        throw new BadRequestException(
          'Plaintext attachment captions are not allowed',
        );
      }

      const hasAnyEncryptedCaptionField =
        Boolean(encryptedContent) ||
        Boolean(encryptionNonce) ||
        Boolean(encryptionMac) ||
        encryptionVersion !== undefined;

      if (hasAnyEncryptedCaptionField) {
        if (!encryptedContent) {
          throw new BadRequestException(
            'Encrypted attachment caption is required',
          );
        }

        if (encryptedContent.length > MAX_ENCRYPTED_CONTENT_LENGTH) {
          throw new BadRequestException(
            'Encrypted attachment caption is too large',
          );
        }

        assertBase64(encryptedContent, 'Encrypted attachment caption');

        assertBase64(encryptionNonce, 'Encryption nonce', 12);

        assertBase64(encryptionMac, 'Encryption MAC', 16);

        if (encryptionVersion !== 1) {
          throw new BadRequestException('Unsupported chat encryption version');
        }
      }
    }
  }

  private async getAstrologerChatMetadata(userId: string) {
    const astrologer = await this.prisma.astrologer.findUnique({
      where: {
        userId,
      },
      select: {
        rating: true,
        totalReviews: true,
        expertise: {
          select: {
            expertise: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!astrologer) {
      return {
        rating: null,
        totalReviews: 0,
        expertise: [] as string[],
      };
    }

    return {
      rating:
        astrologer.rating === null || astrologer.rating === undefined
          ? null
          : Number(astrologer.rating),
      totalReviews: astrologer.totalReviews,
      expertise: astrologer.expertise
        .map((item) => item.expertise.name.trim())
        .filter(Boolean),
    };
  }
  private serializeParticipant(participant: ParticipantData) {
    return {
      id: participant.id,

      name:
        participant.name ||
        (participant.isAstrologer ? 'Astrologer' : 'Astro Soul Path User'),

      avatarUrl: participant.avatarUrl,

      isAstrologer: participant.isAstrologer,
    };
  }

  private async createAttachmentAccessUrl(
    attachmentPath: string | null | undefined,
    legacyAttachmentUrl: string | null | undefined,
  ): Promise<string | null> {
    const normalizedPath = attachmentPath?.trim();

    if (normalizedPath) {
      try {
        const client = this.supabaseService.getStorageClient();

        const { data, error } = await client.storage
          .from('chat')
          .createSignedUrl(normalizedPath, 60 * 10);

        if (!error && data?.signedUrl?.trim()) {
          return data.signedUrl.trim();
        }
      } catch {
        // Attachment signing failure must not break the chat itself.
      }

      return null;
    }

    // Legacy compatibility:
    // messages created before private attachmentPath support
    // may only contain the old attachmentUrl.
    const normalizedLegacyUrl = legacyAttachmentUrl?.trim();

    return normalizedLegacyUrl || null;
  }

  private async serializeMessage(message: ChatMessageWithSender) {
    const attachmentUrl = await this.createAttachmentAccessUrl(
      message.attachmentPath,
      message.attachmentUrl,
    );

    const replyAttachmentUrl = message.replyToMessage
      ? await this.createAttachmentAccessUrl(
          message.replyToMessage.attachmentPath,
          message.replyToMessage.attachmentUrl,
        )
      : null;

    return {
      id: message.id,

      callSessionId: message.callSessionId,

      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      replyToMessageId: message.replyToMessageId,

      replyToMessage: message.replyToMessage
        ? {
            id: message.replyToMessage.id,
            senderId: message.replyToMessage.senderId,
            sender: {
              id: message.replyToMessage.sender.id,
              name:
                message.replyToMessage.sender.name || 'Astro Soul Path User',
              avatarUrl: message.replyToMessage.sender.avatarUrl,
              isAstrologer: message.replyToMessage.sender.isAstrologer,
            },
            messageType: message.replyToMessage.messageType,
            content:
              message.replyToMessage.messageType === ChatMessageType.SYSTEM
                ? message.replyToMessage.content
                : null,
            encryptedContent: message.replyToMessage.encryptedContent,
            encryptionNonce: message.replyToMessage.encryptionNonce,
            encryptionMac: message.replyToMessage.encryptionMac,
            encryptionVersion: message.replyToMessage.encryptionVersion,
            attachment: replyAttachmentUrl
              ? {
                  url: replyAttachmentUrl,
                  name: message.replyToMessage.attachmentName,
                  mimeType: message.replyToMessage.attachmentMimeType,
                  size: message.replyToMessage.attachmentSize,
                }
              : null,
          }
        : null,

      sender: {
        id: message.sender.id,
        name: message.sender.name || 'Astro Soul Path User',
        avatarUrl: message.sender.avatarUrl,
        isAstrologer: message.sender.isAstrologer,
      },

      messageType: message.messageType,

      content:
        message.messageType === ChatMessageType.SYSTEM ? message.content : null,

      encryptedContent: message.encryptedContent,
      encryptionNonce: message.encryptionNonce,
      encryptionMac: message.encryptionMac,
      encryptionVersion: message.encryptionVersion,

      attachment: attachmentUrl
        ? {
            url: attachmentUrl,
            name: message.attachmentName,
            mimeType: message.attachmentMimeType,
            size: message.attachmentSize,
            audioDurationMs: message.audioDurationMs,
          }
        : null,

      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private normalizeEncryptionDeviceId(deviceId: string): string {
    const normalized = this.normalizeRequiredValue(deviceId, 'Device ID');

    if (normalized.length > 128) {
      throw new BadRequestException('Device ID is too long');
    }

    return normalized;
  }

  private normalizeX25519PublicKey(publicKey: string): string {
    const normalized = this.normalizeRequiredValue(
      publicKey,
      'Encryption public key',
    );

    let bytes: Buffer;

    try {
      bytes = Buffer.from(normalized, 'base64');
    } catch {
      throw new BadRequestException('Encryption public key is invalid');
    }

    if (bytes.length !== 32) {
      throw new BadRequestException(
        'Encryption public key must be a 32-byte X25519 public key',
      );
    }

    const canonical = bytes.toString('base64');

    if (canonical.replace(/=+$/u, '') !== normalized.replace(/=+$/u, '')) {
      throw new BadRequestException('Encryption public key is invalid');
    }

    return canonical;
  }

  async registerEncryptionDevice(
    supabaseId: string,
    dto: RegisterChatEncryptionDeviceDto,
  ) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const deviceId = this.normalizeEncryptionDeviceId(dto.deviceId);
    const publicKey = this.normalizeX25519PublicKey(dto.publicKey);
    const keyVersion = dto.keyVersion ?? 1;

    const device = await this.prisma.chatEncryptionDevice.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      update: {
        publicKey,
        keyVersion,
        isActive: true,
      },
      create: {
        userId: user.id,
        deviceId,
        publicKey,
        keyVersion,
        isActive: true,
      },
      select: {
        id: true,
        deviceId: true,
        publicKey: true,
        keyVersion: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      message: 'Encryption device registered successfully',
      data: device,
    };
  }

  async getEncryptionParticipants(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      callSessionId,
    );

    const participantUserIds = [callSession.userId, callSession.astrologerId];

    const devices = await this.prisma.chatEncryptionDevice.findMany({
      where: {
        userId: {
          in: participantUserIds,
        },
        isActive: true,
      },
      select: {
        userId: true,
        deviceId: true,
        publicKey: true,
        keyVersion: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return {
      success: true,
      data: {
        callSessionId: callSession.id,
        currentUserId: user.id,
        customerUserId: callSession.userId,
        astrologerUserId: callSession.astrologerId,
        devices,
      },
    };
  }
  private async getExistingSafetyTarget(userId: string) {
    const normalizedUserId = this.normalizeRequiredValue(
      userId,
      'Target user ID',
    );

    const target = await this.prisma.user.findUnique({
      where: {
        id: normalizedUserId,
      },
      select: {
        id: true,
        name: true,
        isAstrologer: true,
        isActive: true,
      },
    });

    if (!target) {
      throw new NotFoundException('The selected user was not found');
    }

    return target;
  }

  private async assertParticipantsCanInteract(
    firstUserId: string,
    secondUserId: string,
  ): Promise<void> {
    if (firstUserId === secondUserId) {
      return;
    }

    const activeBlock = await this.prisma.userBlock.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            blockerId: firstUserId,
            blockedUserId: secondUserId,
          },
          {
            blockerId: secondUserId,
            blockedUserId: firstUserId,
          },
        ],
      },
      select: {
        blockerId: true,
      },
    });

    if (activeBlock) {
      throw new ForbiddenException(
        activeBlock.blockerId === firstUserId
          ? 'You have blocked this user. Unblock them before sending messages.'
          : 'You cannot message this user.',
      );
    }
  }

  async blockUser(supabaseId: string, targetUserId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);
    const target = await this.getExistingSafetyTarget(targetUserId);

    if (target.id === user.id) {
      throw new BadRequestException('You cannot block your own account');
    }

    const now = new Date();

    const block = await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedUserId: {
          blockerId: user.id,
          blockedUserId: target.id,
        },
      },
      update: {
        isActive: true,
        blockedAt: now,
        unblockedAt: null,
      },
      create: {
        blockerId: user.id,
        blockedUserId: target.id,
        isActive: true,
        blockedAt: now,
      },
      select: {
        id: true,
        blockedUserId: true,
        isActive: true,
        blockedAt: true,
      },
    });

    return {
      success: true,
      message: 'User blocked successfully',
      data: {
        ...block,
        blockedUser: {
          id: target.id,
          name: target.name,
          isAstrologer: target.isAstrologer,
        },
      },
    };
  }

  async unblockUser(supabaseId: string, targetUserId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);
    const target = await this.getExistingSafetyTarget(targetUserId);

    if (target.id === user.id) {
      throw new BadRequestException('You cannot unblock your own account');
    }

    const now = new Date();

    const result = await this.prisma.userBlock.updateMany({
      where: {
        blockerId: user.id,
        blockedUserId: target.id,
        isActive: true,
      },
      data: {
        isActive: false,
        unblockedAt: now,
      },
    });

    return {
      success: true,
      message:
        result.count > 0
          ? 'User unblocked successfully'
          : 'User was not blocked',
      data: {
        userId: target.id,
        unblocked: result.count > 0,
      },
    };
  }

  async getSafetyStatus(supabaseId: string, targetUserId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);
    const target = await this.getExistingSafetyTarget(targetUserId);

    if (target.id === user.id) {
      throw new BadRequestException(
        'Safety status cannot target your own account',
      );
    }

    const blocks = await this.prisma.userBlock.findMany({
      where: {
        isActive: true,
        OR: [
          {
            blockerId: user.id,
            blockedUserId: target.id,
          },
          {
            blockerId: target.id,
            blockedUserId: user.id,
          },
        ],
      },
      select: {
        blockerId: true,
        blockedUserId: true,
        blockedAt: true,
      },
    });

    const blockedByMe = blocks.some(
      (block) =>
        block.blockerId === user.id && block.blockedUserId === target.id,
    );

    const blockedMe = blocks.some(
      (block) =>
        block.blockerId === target.id && block.blockedUserId === user.id,
    );

    return {
      success: true,
      data: {
        userId: target.id,
        blockedByMe,
        blockedMe,
        canMessage: !blockedByMe && !blockedMe,
      },
    };
  }

  async reportUser(supabaseId: string, dto: ReportChatUserDto) {
    const reporter = await this.getAuthenticatedUser(supabaseId);
    const reportedUser = await this.getExistingSafetyTarget(dto.reportedUserId);

    if (reportedUser.id === reporter.id) {
      throw new BadRequestException('You cannot report your own account');
    }

    const normalizedCallSessionId = this.normalizeOptionalValue(
      dto.callSessionId,
    );

    if (normalizedCallSessionId) {
      const callSession = await this.getAccessibleCallSession(
        reporter.id,
        normalizedCallSessionId,
      );

      const participantIds = [callSession.user.id, callSession.astrologer.id];

      if (!participantIds.includes(reportedUser.id)) {
        throw new BadRequestException(
          'Reported user did not participate in this consultation',
        );
      }
    }

    const report = await this.prisma.userReport.create({
      data: {
        reporterId: reporter.id,
        reportedUserId: reportedUser.id,
        callSessionId: normalizedCallSessionId,
        reason: dto.reason,
        details: this.normalizeOptionalValue(dto.details),
      },
      select: {
        id: true,
        reportedUserId: true,
        callSessionId: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      message: 'Report submitted for review',
      data: report,
    };
  }
  async joinChat(supabaseId: string, dto: JoinChatDto) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      dto.callSessionId,
    );

    const astrologerMetadata = await this.getAstrologerChatMetadata(
      callSession.astrologer.id,
    );

    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        callSessionId: callSession.id,

        senderId: {
          not: user.id,
        },

        isRead: false,
      },
    });

    return {
      success: true,

      message: 'Chat room joined successfully',

      data: {
        roomId: callSession.id,

        channelName: callSession.channelName,

        status: callSession.status,

        startedAt: callSession.startedAt,

        expiresAt: callSession.expiresAt,

        endedAt: callSession.endedAt,

        unreadCount,

        currentUser: {
          id: user.id,

          name: user.name || 'Astro Soul Path User',

          avatarUrl: user.avatarUrl,

          isAstrologer: user.isAstrologer,
        },

        customer: this.serializeParticipant(callSession.user),

        astrologer: {
          ...this.serializeParticipant(callSession.astrologer),
          rating: astrologerMetadata.rating,
          totalReviews: astrologerMetadata.totalReviews,
          expertise: astrologerMetadata.expertise,
        },
      },
    };
  }

  async getCallSessionForChatUpload(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    return this.getAccessibleCallSession(user.id, callSessionId);
  }
  async sendMessage(supabaseId: string, dto: SendMessageDto) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      dto.callSessionId,
    );

    const otherParticipantId =
      user.id === callSession.user.id
        ? callSession.astrologer.id
        : callSession.user.id;

    await this.assertParticipantsCanInteract(user.id, otherParticipantId);
    this.assertCallIsActive(callSession);

    this.validateMessagePayload(dto);

    const messageType = dto.messageType ?? ChatMessageType.TEXT;
    const clientMessageId = this.normalizeOptionalValue(dto.clientMessageId);
    const replyToMessageId = this.normalizeOptionalValue(dto.replyToMessageId);

    if (replyToMessageId) {
      const repliedMessage = await this.prisma.chatMessage.findFirst({
        where: {
          id: replyToMessageId,
          callSessionId: callSession.id,
        },
        select: {
          id: true,
        },
      });

      if (!repliedMessage) {
        throw new BadRequestException(
          'The message you are replying to was not found in this consultation',
        );
      }
    }

    if (clientMessageId) {
      const existingMessage = await this.prisma.chatMessage.findFirst({
        where: {
          senderId: user.id,
          clientMessageId,
          replyToMessageId,
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
          replyToMessage: {
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
          },
        },
      });

      if (existingMessage) {
        return {
          success: true,

          message: 'Message already processed',

          data: {
            message: await this.serializeMessage(existingMessage),
            duplicate: true,
          },
        };
      }
    }

    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          callSessionId: callSession.id,

          senderId: user.id,

          clientMessageId,

          replyToMessageId,

          messageType,

          content:
            messageType === ChatMessageType.SYSTEM
              ? this.normalizeOptionalValue(dto.content)
              : null,

          encryptedContent:
            messageType === ChatMessageType.SYSTEM
              ? null
              : this.normalizeOptionalValue(dto.encryptedContent),

          encryptionNonce:
            messageType === ChatMessageType.SYSTEM
              ? null
              : this.normalizeOptionalValue(dto.encryptionNonce),

          encryptionMac:
            messageType === ChatMessageType.SYSTEM
              ? null
              : this.normalizeOptionalValue(dto.encryptionMac),

          encryptionVersion:
            messageType === ChatMessageType.SYSTEM
              ? null
              : (dto.encryptionVersion ?? null),

          attachmentUrl: this.normalizeOptionalValue(dto.attachmentUrl),

          attachmentPath: this.normalizeOptionalValue(dto.attachmentPath),

          attachmentName: this.normalizeOptionalValue(dto.attachmentName),

          attachmentMimeType: this.normalizeOptionalValue(
            dto.attachmentMimeType,
          ),

          attachmentSize: dto.attachmentSize ?? null,

          audioDurationMs:
            messageType === ChatMessageType.AUDIO
              ? (dto.audioDurationMs ?? null)
              : null,

          isRead: false,

          readAt: null,
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
          replyToMessage: {
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
          },
        },
      });

      const receiverId =
        user.id === callSession.user.id
          ? callSession.astrologer.id
          : callSession.user.id;

      try {
        const pushBody =
          message.messageType === ChatMessageType.TEXT
            ? 'New secure chat message'
            : message.messageType === ChatMessageType.IMAGE
              ? 'Sent you a photo'
              : message.messageType === ChatMessageType.FILE
                ? 'Sent you a file'
                : message.messageType === ChatMessageType.AUDIO
                  ? 'Sent you a voice note'
                  : 'New chat message';

        await this.notificationsPushService.sendToUser(receiverId, {
          title: user.name?.trim() || 'Astro Soul Path',
          body: pushBody,
          data: {
            type: 'CHAT_MESSAGE',
            consultationId: callSession.id,
            callSessionId: callSession.id,
            messageId: message.id,
          },
        });
      } catch {
        // Chat delivery must not fail when push delivery fails.
      }
      return {
        success: true,

        message: 'Message sent successfully',

        data: {
          message: await this.serializeMessage(message),
          duplicate: false,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        clientMessageId
      ) {
        const existingMessage = await this.prisma.chatMessage.findFirst({
          where: {
            senderId: user.id,
            clientMessageId,
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
            replyToMessage: {
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
            },
          },
        });

        if (existingMessage) {
          return {
            success: true,

            message: 'Message already processed',

            data: {
              message: await this.serializeMessage(existingMessage),
              duplicate: true,
            },
          };
        }
      }

      throw error;
    }
  }

  async getChatHistory(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      callSessionId,
    );

    const [newestMessages, total, unreadCount] = await this.prisma.$transaction(
      [
        this.prisma.chatMessage.findMany({
          where: {
            callSessionId: callSession.id,
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
            replyToMessage: {
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
            },
          },
        }),

        this.prisma.chatMessage.count({
          where: {
            callSessionId: callSession.id,
          },
        }),

        this.prisma.chatMessage.count({
          where: {
            callSessionId: callSession.id,

            senderId: {
              not: user.id,
            },

            isRead: false,
          },
        }),
      ],
    );

    const messages = newestMessages.reverse();

    return {
      success: true,

      data: {
        callSession: {
          id: callSession.id,

          channelName: callSession.channelName,

          status: callSession.status,

          startedAt: callSession.startedAt,

          expiresAt: callSession.expiresAt,

          endedAt: callSession.endedAt,

          customer: this.serializeParticipant(callSession.user),

          astrologer: this.serializeParticipant(callSession.astrologer),
        },

        messages: await Promise.all(
          messages.map((message) => this.serializeMessage(message)),
        ),

        total,
        unreadCount,
      },
    };
  }

  async markMessagesAsRead(supabaseId: string, dto: MarkMessageReadDto) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      dto.callSessionId,
    );

    const messageIds = this.normalizeMessageIds(dto.messageIds);

    if (messageIds.length === 0) {
      throw new BadRequestException('At least one message ID is required');
    }

    const validMessages = await this.prisma.chatMessage.findMany({
      where: {
        id: {
          in: messageIds,
        },

        callSessionId: callSession.id,

        senderId: {
          not: user.id,
        },
      },

      select: {
        id: true,
      },
    });

    const validMessageIds = validMessages.map((message) => message.id);

    if (validMessageIds.length === 0) {
      return {
        success: true,

        message: 'No unread messages were found',

        data: {
          callSessionId: callSession.id,

          messageIds: [],

          updatedCount: 0,

          readAt: new Date(),
        },
      };
    }

    const readAt = new Date();

    const updateResult = await this.prisma.chatMessage.updateMany({
      where: {
        id: {
          in: validMessageIds,
        },

        callSessionId: callSession.id,

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

      message: 'Messages marked as read',

      data: {
        callSessionId: callSession.id,

        messageIds: validMessageIds,

        updatedCount: updateResult.count,

        readAt,
      },
    };
  }

  async markAllMessagesAsRead(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      callSessionId,
    );

    const unreadMessages = await this.prisma.chatMessage.findMany({
      where: {
        callSessionId: callSession.id,

        senderId: {
          not: user.id,
        },

        isRead: false,
      },

      select: {
        id: true,
      },
    });

    const messageIds = unreadMessages.map((message) => message.id);

    const readAt = new Date();

    if (messageIds.length > 0) {
      await this.prisma.chatMessage.updateMany({
        where: {
          id: {
            in: messageIds,
          },

          callSessionId: callSession.id,

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
    }

    return {
      success: true,

      message: 'All messages marked as read',

      data: {
        callSessionId: callSession.id,

        messageIds,

        updatedCount: messageIds.length,

        readAt,
      },
    };
  }

  async getUnreadCount(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      callSessionId,
    );

    const unreadCount = await this.prisma.chatMessage.count({
      where: {
        callSessionId: callSession.id,

        senderId: {
          not: user.id,
        },

        isRead: false,
      },
    });

    return {
      success: true,

      data: {
        callSessionId: callSession.id,

        unreadCount,
      },
    };
  }

  async verifyChatAccess(supabaseId: string, callSessionId: string) {
    const user = await this.getAuthenticatedUser(supabaseId);

    const callSession = await this.getAccessibleCallSession(
      user.id,
      callSessionId,
    );

    return {
      user,
      callSession,
    };
  }

  async getMessageById(messageId: string): Promise<ChatMessage | null> {
    const normalizedMessageId = this.normalizeOptionalValue(messageId);

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
