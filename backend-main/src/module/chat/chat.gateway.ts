import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import {
  jwtVerify,
  type JWTPayload,
} from 'jose';
import type {
  Server,
  Socket,
} from 'socket.io';

import { ChatService } from './chat.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

type ChatErrorCode =
  | 'INVALID_PAYLOAD'
  | 'NOT_AUTHENTICATED'
  | 'NOT_AUTHORIZED'
  | 'CALL_SESSION_NOT_FOUND'
  | 'CALL_SESSION_ENDED'
  | 'CALL_SESSION_EXPIRED'
  | 'ROOM_NOT_JOINED'
  | 'MESSAGE_NOT_FOUND'
  | 'MESSAGE_SEND_FAILED'
  | 'INTERNAL_ERROR';

type SocketAuthData = {
  supabaseId?: string;
  userId?: string;
  userName?: string | null;
  joinedRooms?: Set<string>;
};

type AuthenticatedSocket = Socket & {
  data: SocketAuthData;
};

type LeaveChatPayload = {
  callSessionId: string;
};

type ReadAllPayload = {
  callSessionId: string;
};

type TypingPayload = {
  callSessionId: string;
  isTyping: boolean;
};

@WebSocketGateway({
  namespace: '/chat',

  cors: {
    origin: true,
    credentials: true,
  },

  transports: [
    'websocket',
    'polling',
  ],
})
export class ChatGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(
    client: AuthenticatedSocket,
  ): Promise<void> {
    try {
      const token =
        this.extractToken(client);

      if (!token) {
        throw this.createSocketError(
          'NOT_AUTHENTICATED',
          'Authentication token is required',
        );
      }

      const jwtPayload =
        await this.verifyAccessToken(
          token,
        );

      const supabaseId =
        typeof jwtPayload.sub ===
          'string'
          ? jwtPayload.sub.trim()
          : '';

      if (!supabaseId) {
        throw this.createSocketError(
          'NOT_AUTHENTICATED',
          'Authenticated user ID is missing from the token',
        );
      }

      client.data.supabaseId =
        supabaseId;

      client.data.joinedRooms =
        new Set<string>();

      client.emit(
        'chat:connected',
        {
          success: true,
          socketId: client.id,
          connectedAt:
            new Date().toISOString(),
        },
      );
    } catch (error: unknown) {
      this.emitError(
        client,
        error,
      );

      client.disconnect(true);
    }
  }

  handleDisconnect(
    client: AuthenticatedSocket,
  ): void {
    const joinedRooms =
      client.data.joinedRooms;

    if (
      !joinedRooms ||
      joinedRooms.size === 0
    ) {
      return;
    }

    const userId =
      client.data.userId;

    for (const roomId of joinedRooms) {
      client
        .to(roomId)
        .emit(
          'chat:presence',
          {
            callSessionId:
              roomId,

            userId:
              userId ?? '',

            isOnline:
              false,

            socketId:
              client.id,

            lastSeenAt:
              new Date().toISOString(),
          },
        );
    }

    joinedRooms.clear();
  }

  @SubscribeMessage(
    'chat:join',
  )
  async handleJoin(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    dto: JoinChatDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(
          client,
        );

      const callSessionId =
        this.normalizeCallSessionId(
          dto.callSessionId,
        );

      const result =
        await this.chatService.joinChat(
          supabaseId,
          {
            ...dto,
            callSessionId,
          },
        );

      const roomId =
        this.normalizeCallSessionId(
          result.data.roomId,
        );

      await client.join(
        roomId,
      );

      client.data.joinedRooms?.add(
        roomId,
      );

      client.data.userId =
        result.data.currentUser.id;

      client.data.userName =
        result.data.currentUser.name;

      client
        .to(roomId)
        .emit(
          'chat:presence',
          {
            callSessionId:
              roomId,

            userId:
              result.data.currentUser.id,

            isOnline:
              true,

            socketId:
              client.id,

            lastSeenAt:
              null,
          },
        );

      const payload = {
        success: true,
        callSessionId:
          roomId,
        roomId,
        joinedAt:
          new Date().toISOString(),
      };

      client.emit(
        'chat:joined',
        payload,
      );

      return payload;
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage(
    'chat:leave',
  )
  async handleLeave(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    payload: LeaveChatPayload,
  ) {
    try {
      const callSessionId =
        this.normalizeCallSessionId(
          payload?.callSessionId,
        );

      this.ensureRoomJoined(
        client,
        callSessionId,
      );

      await client.leave(
        callSessionId,
      );

      client.data.joinedRooms?.delete(
        callSessionId,
      );

      client
        .to(callSessionId)
        .emit(
          'chat:presence',
          {
            callSessionId,

            userId:
              client.data.userId ??
              '',

            isOnline:
              false,

            socketId:
              client.id,

            lastSeenAt:
              new Date().toISOString(),
          },
        );

      const response = {
        success: true,

        callSessionId,

        roomId:
          callSessionId,

        leftAt:
          new Date().toISOString(),
      };

      client.emit(
        'chat:left',
        response,
      );

      return response;
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage(
    'chat:message',
  )
  async handleMessage(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    dto: SendMessageDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(
          client,
        );

      const callSessionId =
        this.normalizeCallSessionId(
          dto.callSessionId,
        );

      this.ensureRoomJoined(
        client,
        callSessionId,
      );

      const result =
        await this.chatService.sendMessage(
          supabaseId,
          {
            ...dto,
            callSessionId,
          },
        );

      this.server
        .to(callSessionId)
        .emit(
          'chat:message',
          result.data.message,
        );

      return result;
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
        'MESSAGE_SEND_FAILED',
      );
    }
  }

  @SubscribeMessage(
    'chat:read',
  )
  async handleReadReceipt(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    dto: MarkMessageReadDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(
          client,
        );

      const callSessionId =
        this.normalizeCallSessionId(
          dto.callSessionId,
        );

      this.ensureRoomJoined(
        client,
        callSessionId,
      );

      const result =
        await this.chatService.markMessagesAsRead(
          supabaseId,
          {
            ...dto,
            callSessionId,
          },
        );

      const payload = {
        ...result.data,

        success: true,

        callSessionId,

        readerId:
          client.data.userId,

        readAt:
          result.data.readAt ??
          new Date().toISOString(),
      };

      this.server
        .to(callSessionId)
        .emit(
          'chat:read',
          payload,
        );

      return {
        ...result,
        data: payload,
      };
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage(
    'chat:read-all',
  )
  async handleReadAll(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    payload: ReadAllPayload,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(
          client,
        );

      const callSessionId =
        this.normalizeCallSessionId(
          payload?.callSessionId,
        );

      this.ensureRoomJoined(
        client,
        callSessionId,
      );

      const result =
        await this.chatService.markAllMessagesAsRead(
          supabaseId,
          callSessionId,
        );

      const readPayload = {
        ...result.data,

        success: true,

        callSessionId,

        readerId:
          client.data.userId,

        readAt:
          result.data.readAt ??
          new Date().toISOString(),
      };

      this.server
        .to(callSessionId)
        .emit(
          'chat:read-all',
          readPayload,
        );

      return {
        ...result,
        data: readPayload,
      };
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage(
    'chat:typing',
  )
  async handleTyping(
    @ConnectedSocket()
    client: AuthenticatedSocket,

    @MessageBody()
    payload: TypingPayload,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(
          client,
        );

      const callSessionId =
        this.normalizeCallSessionId(
          payload?.callSessionId,
        );

      this.ensureRoomJoined(
        client,
        callSessionId,
      );

      await this.chatService.verifyChatAccess(
        supabaseId,
        callSessionId,
      );

      const typingPayload = {
        callSessionId,

        userId:
          client.data.userId ??
          '',

        userName:
          client.data.userName ??
          null,

        isTyping:
          Boolean(
            payload.isTyping,
          ),

        occurredAt:
          new Date().toISOString(),
      };

      client
        .to(callSessionId)
        .emit(
          'chat:typing',
          typingPayload,
        );

      return {
        success: true,
        data:
          typingPayload,
      };
    } catch (error: unknown) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  private extractToken(
    client: AuthenticatedSocket,
  ): string | null {
    const authToken =
      client.handshake.auth
        ?.token;

    if (
      typeof authToken ===
        'string' &&
      authToken.trim()
    ) {
      return authToken.trim();
    }

    const authorization =
      client.handshake.headers
        .authorization;

    if (
      typeof authorization ===
        'string'
    ) {
      const [
        scheme,
        value,
      ] =
        authorization.split(
          /\s+/,
          2,
        );

      if (
        scheme?.toLowerCase() ===
          'bearer' &&
        value?.trim()
      ) {
        return value.trim();
      }
    }

    return null;
  }

  private async verifyAccessToken(
    token: string,
  ): Promise<JWTPayload> {
    const jwtSecret =
      this.configService
        .get<string>(
          'SUPABASE_JWT_SECRET',
        )
        ?.trim() ||
      this.configService
        .get<string>(
          'JWT_SECRET',
        )
        ?.trim();

    if (!jwtSecret) {
      throw this.createSocketError(
        'INTERNAL_ERROR',
        'Supabase JWT secret is not configured',
      );
    }

    try {
      const secret =
        new TextEncoder().encode(
          jwtSecret,
        );

      const {
        payload,
      } =
        await jwtVerify(
          token,
          secret,
          {
            algorithms: [
              'HS256',
            ],
          },
        );

      return payload;
    } catch {
      throw this.createSocketError(
        'NOT_AUTHENTICATED',
        'Invalid or expired authentication token',
      );
    }
  }

  private getSupabaseId(
    client: AuthenticatedSocket,
  ): string {
    const supabaseId =
      client.data.supabaseId
        ?.trim();

    if (!supabaseId) {
      throw this.createSocketError(
        'NOT_AUTHENTICATED',
        'Socket authentication is missing',
      );
    }

    return supabaseId;
  }

  private normalizeCallSessionId(
    value: unknown,
  ): string {
    if (
      typeof value !==
      'string'
    ) {
      throw this.createSocketError(
        'INVALID_PAYLOAD',
        'Call session ID is required',
      );
    }

    const normalized =
      value.trim();

    if (!normalized) {
      throw this.createSocketError(
        'INVALID_PAYLOAD',
        'Call session ID is required',
      );
    }

    return normalized;
  }

  private ensureRoomJoined(
    client: AuthenticatedSocket,
    callSessionId: string,
  ): void {
    const hasJoined =
      client.data.joinedRooms?.has(
        callSessionId,
      );

    if (!hasJoined) {
      throw this.createSocketError(
        'ROOM_NOT_JOINED',
        'Join the chat room before performing this action',
      );
    }
  }

  private createSocketError(
    code: ChatErrorCode,
    message: string,
  ): Error & {
    code: ChatErrorCode;
  } {
    const error =
      new Error(message) as Error & {
        code: ChatErrorCode;
      };

    error.code = code;

    return error;
  }

  private getErrorCode(
    error: unknown,
    fallback:
      ChatErrorCode =
        'INTERNAL_ERROR',
  ): ChatErrorCode {
    if (
      error &&
      typeof error ===
        'object' &&
      'code' in error
    ) {
      const code =
        String(
          error.code,
        ) as ChatErrorCode;

      return code;
    }

    if (
      error &&
      typeof error ===
        'object' &&
      'status' in error
    ) {
      const status =
        Number(error.status);

      if (status === 401) {
        return 'NOT_AUTHENTICATED';
      }

      if (status === 403) {
        return 'NOT_AUTHORIZED';
      }

      if (status === 404) {
        return 'CALL_SESSION_NOT_FOUND';
      }
    }

    return fallback;
  }

  private emitError(
    client: AuthenticatedSocket,
    error: unknown,
    fallbackCode:
      ChatErrorCode =
        'INTERNAL_ERROR',
  ) {
    const message =
      error instanceof Error
        ? error.message
        : 'Chat request failed';

    const payload = {
      success: false as const,

      code:
        this.getErrorCode(
          error,
          fallbackCode,
        ),

      message,

      occurredAt:
        new Date().toISOString(),
    };

    client.emit(
      'chat:error',
      payload,
    );

    return payload;
  }
}