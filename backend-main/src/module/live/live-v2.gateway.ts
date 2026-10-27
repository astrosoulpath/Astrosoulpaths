import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  validateSync,
} from 'class-validator';
import type { JWTPayload } from 'jose';
import type { Socket } from 'socket.io';
import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';
import { LiveResumeDto } from './live-v2.dto';
import { LiveV2Events, type LiveEndedEvent } from './live-v2.events';
import { LiveV2Service, type LiveSocketBinding } from './live-v2.service';

class SocketBindDto extends LiveResumeDto {
  @IsString() @MinLength(1) @MaxLength(8192) token!: string;
  @IsString() @MinLength(1) @MaxLength(128) liveSessionId!: string;
  @IsUUID('4') connectionId!: string;
}
class SocketMessageDto {
  @IsString() @MinLength(1) @MaxLength(500) message!: string;
}
interface Entry {
  client: Socket;
  token: string;
  actor: JWTPayload;
  binding: LiveSocketBinding;
  expiry?: ReturnType<typeof setTimeout>;
  traffic?: Partial<
    Record<'message' | 'heartbeat', { until: number; count: number }>
  >;
}

@WebSocketGateway({
  namespace: '/live-v2',
  transports: ['websocket', 'polling'],
  cors: { origin: true, credentials: true },
})
export class LiveV2Gateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  private readonly clients = new Map<string, Entry>();
  private readonly connections = new Map<string, Entry>();
  private unsubscribe?: () => void;
  constructor(
    private readonly live: LiveV2Service,
    private readonly jwt: SupabaseJwtService,
    private readonly events: LiveV2Events,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.unsubscribe?.();
    this.unsubscribe = this.events.subscribe((event) => this.ended(event));
  }
  private enabled() {
    // No cross-instance adapter exists yet. Do not silently enable a distributed
    // deployment with only process-local binding replacement/event delivery.
    return (
      this.config.get('LIVE_V2_ENABLED') === 'true' &&
      this.config.get('LIVE_V2_SOCKET_ENABLED') === 'true' &&
      this.config.get('LIVE_V2_SOCKET_SINGLE_INSTANCE') === 'true' &&
      this.config.get('LIVE_V2_MAINTENANCE_ENABLED') === 'true'
    );
  }
  private parse<T extends object>(type: new () => T, raw: unknown): T {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid payload');
    const value = plainToInstance(type, raw);
    if (
      validateSync(value, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }).length
    ) {
      throw new Error('Invalid payload');
    }
    return value;
  }
  private valid(actor: JWTPayload) {
    if (
      !actor.sub ||
      !Number.isFinite(actor.exp) ||
      actor.exp! * 1000 <= Date.now()
    )
      throw new Error('Authentication expired');
  }
  async handleConnection(client: Socket) {
    try {
      if (!this.enabled() || this.clients.has(client.id))
        throw new Error('V2 socket unavailable');
      const body = this.parse(SocketBindDto, client.handshake.auth);
      const actor = await this.jwt.verifyAccessToken(body.token);
      this.valid(actor);
      if (!client.connected) return;
      const binding = await this.live.bindSocket(
        actor,
        body.liveSessionId,
        body.connectionId,
        body,
      );
      if (!client.connected) return;
      const previous = this.connections.get(binding.connectionId);
      // Same idempotent bind replay cannot claim two simultaneous sockets.
      if (previous && previous.binding.generation >= binding.generation)
        throw new Error('Duplicate binding');
      if (previous) this.drop(previous.client);
      const entry: Entry = { client, actor, token: body.token, binding };
      this.clients.set(client.id, entry);
      this.connections.set(binding.connectionId, entry);
      entry.expiry = setTimeout(
        () => {
          client.emit('live:auth-required', { code: 'AUTH_EXPIRED' });
          this.drop(client);
        },
        Math.min(actor.exp! * 1000 - Date.now(), 2147483647),
      );
      entry.expiry.unref?.();
      await client.join(this.room(binding.sessionId));
      if (!client.connected || this.clients.get(client.id) !== entry) return;
      await this.live.socketAccess(actor, binding);
      if (!client.connected || this.clients.get(client.id) !== entry) return;
      client.emit('live:connected', {
        liveSessionId: binding.sessionId,
        connectionId: binding.connectionId,
        generation: binding.generation,
      });
      client.emit('live:joined', {
        liveSessionId: binding.sessionId,
        generation: binding.generation,
      });
    } catch {
      this.reject(client);
    } finally {
      // Never retain/log handshake resume proofs. JWT is kept only in the
      // private active-entry map for re-verification and cleared on disconnect.
      if (client.handshake.auth) {
        delete client.handshake.auth.resumeSecret;
        delete client.handshake.auth.token;
      }
    }
  }
  private room(id: string) {
    return `live:v2:${id}`;
  }
  private async authenticated(entry: Entry) {
    if (
      !entry.client.connected ||
      this.clients.get(entry.client.id) !== entry ||
      this.connections.get(entry.binding.connectionId) !== entry
    )
      throw new Error('Socket not bound');
    this.valid(entry.actor);
    const actor = await this.jwt.verifyAccessToken(entry.token);
    if (
      !entry.client.connected ||
      this.clients.get(entry.client.id) !== entry ||
      this.connections.get(entry.binding.connectionId) !== entry
    )
      throw new Error('Socket binding replaced');
    this.valid(actor);
    if (actor.sub !== entry.actor.sub)
      throw new Error('Socket account changed');
    return actor;
  }
  private get(client: Socket) {
    const entry = this.clients.get(client.id);
    if (!entry) throw new Error('Authentication required');
    return entry;
  }
  private limit(entry: Entry, kind: 'message' | 'heartbeat', maximum: number) {
    const now = Date.now();
    entry.traffic ??= {};
    let window = entry.traffic[kind];
    if (!window || window.until <= now)
      window = entry.traffic[kind] = { until: now + 10000, count: 0 };
    if (++window.count > maximum)
      throw new Error('Live traffic limit exceeded');
  }
  @SubscribeMessage('live:heartbeat')
  async heartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body?: unknown,
  ) {
    try {
      if (
        body !== undefined &&
        (!body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          Object.keys(body).length)
      )
        throw new Error('Invalid heartbeat');
      const entry = this.get(client);
      this.limit(entry, 'heartbeat', 10);
      const actor = await this.authenticated(entry);
      const result = await this.live.socketHeartbeat(actor, entry.binding);
      client.emit('live:heartbeat', result);
    } catch {
      this.reject(client);
    }
  }
  @SubscribeMessage('live:message')
  async message(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ) {
    try {
      const body = this.parse(SocketMessageDto, raw);
      const entry = this.get(client);
      this.limit(entry, 'message', 20);
      const actor = await this.authenticated(entry);
      const message = await this.live.socketMessage(
        actor,
        entry.binding,
        body.message,
      );
      for (const recipient of [...this.clients.values()]) {
        if (recipient.binding.sessionId !== entry.binding.sessionId) continue;
        try {
          const current = await this.authenticated(recipient);
          await this.live.socketAccess(current, recipient.binding);
          if (
            !recipient.client.connected ||
            this.clients.get(recipient.client.id) !== recipient
          )
            continue;
          recipient.client.emit('live:message', message);
        } catch {
          this.drop(recipient.client);
        }
      }
    } catch {
      this.reject(client);
    }
  }
  private async ended(event: LiveEndedEvent) {
    for (const entry of [...this.clients.values()]) {
      if (entry.binding.sessionId !== event.sessionId) continue;
      try {
        await this.authenticated(entry);
        entry.client.emit('live:ended', event);
      } catch {
        /* Do not disclose to expired/invalid authentication. */
      } finally {
        this.drop(entry.client);
      }
    }
  }
  private reject(client: Socket) {
    client.emit('live:error', {
      code: 'LIVE_V2_REJECTED',
      message:
        'Live authentication or connection is no longer valid. Refresh your session and reconnect.',
    });
    this.drop(client);
  }
  private drop(client: Socket) {
    this.handleDisconnect(client);
    // Disconnect only Live v2, preserving any consultation namespace sharing
    // the underlying transport.
    client.disconnect(false);
  }
  handleDisconnect(client: Socket) {
    const entry = this.clients.get(client.id);
    if (!entry) return;
    if (entry.expiry) clearTimeout(entry.expiry);
    this.clients.delete(client.id);
    if (this.connections.get(entry.binding.connectionId) === entry)
      this.connections.delete(entry.binding.connectionId);
    // Do not close/extend leases or end Live on a transport disconnect.
  }
  onModuleDestroy() {
    this.unsubscribe?.();
    for (const entry of [...this.clients.values()]) this.drop(entry.client);
  }
}
