import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';
import { LiveService } from './live.service';

@WebSocketGateway({
  namespace: '/live-chat',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly liveService: LiveService,
    private readonly supabaseJwtService: SupabaseJwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        throw new Error('Authentication required');
      }

      const supabaseId = await this.verifyToken(token);

      if (!supabaseId) {
        throw new Error('Invalid authentication token');
      }

      client.data.supabaseId = supabaseId;

      client.emit('live:connected', {
        connected: true,
      });
    } catch (error) {
      client.emit('live:error', {
        message:
          error instanceof Error ? error.message : 'Authentication failed',
      });

      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    client.data.liveSessionId = undefined;
  }

  @SubscribeMessage('live:join')
  async joinLiveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { liveSessionId?: string },
  ) {
    try {
      const supabaseId = this.getSupabaseId(client);
      const liveSessionId = String(body?.liveSessionId ?? '').trim();

      if (!liveSessionId) {
        throw new Error('Live session is required');
      }

      const access = await this.liveService.joinLiveChat(
        supabaseId,
        liveSessionId,
      );

      const previousLiveSessionId = client.data.liveSessionId as
        | string
        | undefined;

      if (previousLiveSessionId && previousLiveSessionId !== liveSessionId) {
        await client.leave(this.room(previousLiveSessionId));
      }

      await client.join(this.room(liveSessionId));
      client.data.liveSessionId = liveSessionId;

      client.emit('live:joined', access);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('live:message')
  async sendLiveMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      liveSessionId?: string;
      message?: string;
    },
  ) {
    try {
      const supabaseId = this.getSupabaseId(client);
      const liveSessionId = String(body?.liveSessionId ?? '').trim();

      if (!liveSessionId) {
        throw new Error('Live session is required');
      }

      if (client.data.liveSessionId !== liveSessionId) {
        throw new Error('Join this live chat before sending a message');
      }

      const message = await this.liveService.sendLiveMessage(
        supabaseId,
        liveSessionId,
        String(body?.message ?? ''),
      );

      this.server.to(this.room(liveSessionId)).emit('live:message', message);
    } catch (error) {
      this.emitError(client, error);
    }
  }

  private room(liveSessionId: string) {
    return `live:${liveSessionId}`;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim().replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === 'string' && header.trim()) {
      return header.trim().replace(/^Bearer\s+/i, '');
    }

    return '';
  }

  private async verifyToken(token: string): Promise<string> {
    const localOtpEnabled =
      String(process.env.LOCAL_OTP_ENABLED ?? '').toLowerCase() === 'true';

    if (process.env.NODE_ENV !== 'production' && localOtpEnabled) {
      if (token.startsWith('local-dev-token:')) {
        const supabaseId = token.slice('local-dev-token:'.length).trim();

        if (supabaseId) {
          return supabaseId;
        }
      }

      if (token === 'local-dev-token') {
        return 'local-supabase-user';
      }

      if (token === 'local-astrologer-token') {
        return 'seed-astrologer-supabase-id';
      }
    }

    const payload = await this.supabaseJwtService.verifyAccessToken(token);

    if (!payload?.sub) {
      throw new Error('Invalid authentication token');
    }

    return payload.sub;
  }

  private getSupabaseId(client: Socket) {
    const supabaseId = client.data.supabaseId;

    if (typeof supabaseId !== 'string' || !supabaseId.trim()) {
      throw new Error('Authentication required');
    }

    return supabaseId.trim();
  }

  private emitError(client: Socket, error: unknown) {
    client.emit('live:error', {
      message:
        error instanceof Error ? error.message : 'Live chat request failed',
    });
  }
}
