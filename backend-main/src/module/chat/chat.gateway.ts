import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { SendMessageDto } from './dto/send-message.dto';

type AuthenticatedSocket = Socket & {
  data: {
    supabaseId?: string;
    userId?: string;
    joinedRooms?: Set<string>;
  };
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
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
  ) {}

  handleConnection(
    client: AuthenticatedSocket,
  ) {
    const token =
      this.extractToken(client);

    if (!token) {
      client.emit('chat:error', {
        message:
          'Authentication token is required',
      });

      client.disconnect(true);
      return;
    }

    /*
     * Temporary bridge:
     * frontend currently stores the Supabase user identifier
     * in the socket auth payload.
     *
     * Next hardening step:
     * verify the JWT signature server-side and extract sub
     * using the same Supabase auth verification used by REST.
     */
    client.data.supabaseId = token;
    client.data.joinedRooms =
      new Set<string>();

    client.emit('chat:connected', {
      socketId: client.id,
    });
  }

  handleDisconnect(
    client: AuthenticatedSocket,
  ) {
    const rooms =
      client.data.joinedRooms;

    if (!rooms) {
      return;
    }

    for (const roomId of rooms) {
      client.to(roomId).emit(
        'chat:presence',
        {
          callSessionId: roomId,
          status: 'offline',
          socketId: client.id,
        },
      );
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    dto: JoinChatDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(client);

      const result =
        await this.chatService.joinChat(
          supabaseId,
          dto,
        );

      const roomId =
        result.data.roomId;

      await client.join(roomId);

      client.data.joinedRooms?.add(
        roomId,
      );

      client.to(roomId).emit(
        'chat:presence',
        {
          callSessionId: roomId,
          status: 'online',
          socketId: client.id,
        },
      );

      client.emit('chat:joined', result);

      return result;
    } catch (error) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      callSessionId: string;
    },
  ) {
    const roomId =
      payload.callSessionId?.trim();

    if (!roomId) {
      return this.emitError(
        client,
        new Error(
          'Call session ID is required',
        ),
      );
    }

    await client.leave(roomId);

    client.data.joinedRooms?.delete(
      roomId,
    );

    client.to(roomId).emit(
      'chat:presence',
      {
        callSessionId: roomId,
        status: 'offline',
        socketId: client.id,
      },
    );

    return {
      success: true,
      data: {
        callSessionId: roomId,
      },
    };
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    dto: SendMessageDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(client);

      const result =
        await this.chatService.sendMessage(
          supabaseId,
          dto,
        );

      this.server
        .to(dto.callSessionId)
        .emit(
          'chat:message',
          result.data.message,
        );

      return result;
    } catch (error) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage('chat:read')
  async handleReadReceipt(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    dto: MarkMessageReadDto,
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(client);

      const result =
        await this.chatService.markMessagesAsRead(
          supabaseId,
          dto,
        );

      this.server
        .to(dto.callSessionId)
        .emit(
          'chat:read',
          result.data,
        );

      return result;
    } catch (error) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage('chat:read-all')
  async handleReadAll(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      callSessionId: string;
    },
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(client);

      const result =
        await this.chatService.markAllMessagesAsRead(
          supabaseId,
          payload.callSessionId,
        );

      this.server
        .to(payload.callSessionId)
        .emit(
          'chat:read-all',
          result.data,
        );

      return result;
    } catch (error) {
      return this.emitError(
        client,
        error,
      );
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket()
    client: AuthenticatedSocket,
    @MessageBody()
    payload: {
      callSessionId: string;
      isTyping: boolean;
    },
  ) {
    try {
      const supabaseId =
        this.getSupabaseId(client);

      await this.chatService.verifyChatAccess(
        supabaseId,
        payload.callSessionId,
      );

      client
        .to(payload.callSessionId)
        .emit('chat:typing', {
          callSessionId:
            payload.callSessionId,
          isTyping:
            Boolean(
              payload.isTyping,
            ),
          socketId: client.id,
        });

      return {
        success: true,
      };
    } catch (error) {
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
      client.handshake.auth?.token;

    if (
      typeof authToken === 'string' &&
      authToken.trim()
    ) {
      return authToken.trim();
    }

    const authorization =
      client.handshake.headers
        .authorization;

    if (
      typeof authorization === 'string' &&
      authorization.startsWith(
        'Bearer ',
      )
    ) {
      return authorization
        .slice(7)
        .trim();
    }

    return null;
  }

  private getSupabaseId(
    client: AuthenticatedSocket,
  ): string {
    const supabaseId =
      client.data.supabaseId;

    if (!supabaseId) {
      throw new Error(
        'Socket authentication is missing',
      );
    }

    return supabaseId;
  }

  private emitError(
    client: AuthenticatedSocket,
    error: unknown,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : 'Chat request failed';

    const payload = {
      success: false,
      message,
    };

    client.emit(
      'chat:error',
      payload,
    );

    return payload;
  }
}