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

import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';

import { CallService } from './call.service';
import { CallSocketService } from './call-socket.service';

const RING_TIMEOUT_MS = 30_000;

type ConsultationType = 'AUDIO' | 'VIDEO';

type RegisterCallSocketPayload = {
  /**
   * Compatibility assertion only.
   * Server authentication never trusts this value as identity.
   */
  userId?: string;
};

type InitiateCallPayload = {
  callId: string;
  recipientUserId: string;
  callerId: string;
  callerName?: string;
  consultationType?: ConsultationType;
};

type AcceptCallPayload = {
  callId: string;
  callerUserId: string;
  receiverUserId: string;
};

type RejectCallPayload = {
  callId: string;
  callerUserId: string;
  receiverUserId: string;
  reason?: string;
};

type CancelCallPayload = {
  callId: string;
  callerUserId?: string;
  recipientUserId: string;
  reason?: string;
};

type RingingCall = {
  callId: string;
  callerUserId: string;
  recipientUserId: string;
  consultationType: ConsultationType;
  initiatedAt: string;
  timeout: ReturnType<typeof setTimeout>;
};

type CallErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_PAYLOAD'
  | 'NOT_REGISTERED'
  | 'IDENTITY_MISMATCH'
  | 'SELF_CALL_NOT_ALLOWED'
  | 'CALL_ALREADY_RINGING'
  | 'USER_ALREADY_BUSY'
  | 'RECIPIENT_UNAVAILABLE'
  | 'CALL_NOT_FOUND'
  | 'PARTICIPANT_MISMATCH'
  | 'UNAUTHORIZED_ACTION';

@WebSocketGateway({
  namespace: '/call',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /**
   * Stores currently ringing calls.
   *
   * Key: callId
   */
  private readonly ringingCalls = new Map<string, RingingCall>();

  /**
   * Stores the user registered against each socket.
   *
   * Key: socketId
   * Value: userId
   */
  private readonly registeredSocketUsers = new Map<string, string>();

  constructor(
    private readonly socketService: CallSocketService,
    private readonly callService: CallService,
    private readonly supabaseJwtService: SupabaseJwtService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const authenticatedId = await this.authenticateSocket(client);

      const canonicalUserId =
        await this.callService.resolveAuthenticatedUserId(authenticatedId);

      client.data.callUserId = canonicalUserId;

      client.emit('call:connected', {
        success: true,
        authenticated: true,
        userId: canonicalUserId,
        socketId: client.id,
        connectedAt: new Date().toISOString(),
      });
    } catch {
      client.emit('call:error', {
        success: false,
        code: 'AUTHENTICATION_FAILED',
        message: 'Call socket authentication failed.',
        occurredAt: new Date().toISOString(),
      });

      client.disconnect(true);
    }
  }
  handleDisconnect(client: Socket): void {
    this.registeredSocketUsers.delete(client.id);
    this.socketService.unregisterSocket(client.id);
  }

  @SubscribeMessage('call:register')
  register(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RegisterCallSocketPayload,
  ) {
    const authenticatedUserId = this.normalizeValue(
      client.data?.callUserId as string | undefined,
    );

    if (!authenticatedUserId) {
      return this.emitError(
        client,
        'NOT_REGISTERED',
        'The call socket is not authenticated.',
      );
    }

    const requestedUserId = this.normalizeValue(payload?.userId);

    /*
     * Client userId may assert identity for compatibility,
     * but it can never establish or switch authenticated identity.
     */
    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      return this.emitError(
        client,
        'IDENTITY_MISMATCH',
        'Socket identity does not match the authenticated account.',
      );
    }

    this.socketService.unregisterSocket(client.id);

    this.registeredSocketUsers.set(client.id, authenticatedUserId);

    this.socketService.registerUser(authenticatedUserId, client);

    const registeredPayload = {
      success: true,
      userId: authenticatedUserId,
      socketId: client.id,
      registeredAt: new Date().toISOString(),
    };

    client.emit('call:registered', registeredPayload);

    return registeredPayload;
  }
  @SubscribeMessage('call:initiate')
  initiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: InitiateCallPayload,
  ) {
    const registeredUserId = this.getRegisteredUserId(client);

    if (!registeredUserId) {
      return this.emitError(
        client,
        'NOT_REGISTERED',
        'Register the socket before initiating a call.',
      );
    }

    const callId = this.normalizeValue(payload?.callId);
    const recipientUserId = this.normalizeValue(payload?.recipientUserId);
    const callerId = this.normalizeValue(payload?.callerId);
    const callerName =
      this.normalizeValue(payload?.callerName) || 'Astro Soul Path User';

    const consultationType = this.normalizeConsultationType(
      payload?.consultationType,
    );

    if (!callId || !recipientUserId || !callerId) {
      return this.emitError(
        client,
        'INVALID_PAYLOAD',
        'Call ID, caller ID and recipient user ID are required.',
      );
    }

    if (registeredUserId !== callerId) {
      return this.emitError(
        client,
        'IDENTITY_MISMATCH',
        'Registered socket user does not match the caller.',
      );
    }

    if (callerId === recipientUserId) {
      return this.emitError(
        client,
        'SELF_CALL_NOT_ALLOWED',
        'You cannot call your own account.',
      );
    }

    if (this.ringingCalls.has(callId)) {
      return this.emitError(
        client,
        'CALL_ALREADY_RINGING',
        'This call is already ringing.',
      );
    }

    if (this.hasActiveRingingCallForUser(callerId)) {
      return this.emitError(
        client,
        'USER_ALREADY_BUSY',
        'The caller already has another ringing call.',
      );
    }

    if (this.hasActiveRingingCallForUser(recipientUserId)) {
      return this.emitError(
        client,
        'USER_ALREADY_BUSY',
        'The recipient is currently busy with another call.',
      );
    }

    const initiatedAt = new Date().toISOString();

    const incomingPayload = {
      success: true,
      callId,
      callerId,
      callerUserId: callerId,
      callerName,
      recipientUserId,
      consultationType,
      status: 'RINGING' as const,
      initiatedAt,
      timeoutSeconds: RING_TIMEOUT_MS / 1000,
    };

    const delivered = this.socketService.emitToUser(
      recipientUserId,
      'call:incoming',
      incomingPayload,
    );

    if (!delivered) {
      const unavailablePayload = {
        success: false,
        callId,
        callerUserId: callerId,
        recipientUserId,
        consultationType,
        status: 'UNAVAILABLE' as const,
        reason: 'The recipient is currently offline.',
        failedAt: new Date().toISOString(),
      };

      client.emit('call:unavailable', unavailablePayload);

      return unavailablePayload;
    }

    const timeout = setTimeout(() => {
      this.handleMissedCall(callId);
    }, RING_TIMEOUT_MS);

    this.ringingCalls.set(callId, {
      callId,
      callerUserId: callerId,
      recipientUserId,
      consultationType,
      initiatedAt,
      timeout,
    });

    const ringingPayload = {
      success: true,
      callId,
      callerUserId: callerId,
      recipientUserId,
      consultationType,
      status: 'RINGING' as const,
      initiatedAt,
      timeoutSeconds: RING_TIMEOUT_MS / 1000,
    };

    client.emit('call:ringing', ringingPayload);

    return ringingPayload;
  }

  @SubscribeMessage('call:accept')
  acceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AcceptCallPayload,
  ) {
    const registeredUserId = this.getRegisteredUserId(client);

    if (!registeredUserId) {
      return this.emitError(
        client,
        'NOT_REGISTERED',
        'Register the socket before accepting a call.',
      );
    }

    const callId = this.normalizeValue(payload?.callId);
    const callerUserId = this.normalizeValue(payload?.callerUserId);
    const receiverUserId = this.normalizeValue(payload?.receiverUserId);

    if (!callId || !callerUserId || !receiverUserId) {
      return this.emitError(
        client,
        'INVALID_PAYLOAD',
        'Call ID, caller user ID and receiver user ID are required.',
      );
    }

    if (registeredUserId !== receiverUserId) {
      return this.emitError(
        client,
        'UNAUTHORIZED_ACTION',
        'Only the call receiver can accept this call.',
      );
    }

    const ringingCall = this.ringingCalls.get(callId);

    if (!ringingCall) {
      return this.emitError(
        client,
        'CALL_NOT_FOUND',
        'This call is no longer ringing.',
      );
    }

    if (
      ringingCall.callerUserId !== callerUserId ||
      ringingCall.recipientUserId !== receiverUserId
    ) {
      return this.emitError(
        client,
        'PARTICIPANT_MISMATCH',
        'Call participant information does not match.',
      );
    }

    this.clearRingingCall(callId);

    const acceptedPayload = {
      success: true,
      callId,
      callerUserId,
      receiverUserId,
      recipientUserId: receiverUserId,
      consultationType: ringingCall.consultationType,
      status: 'ACCEPTED' as const,
      acceptedAt: new Date().toISOString(),
    };

    this.emitToCallParticipants(
      callerUserId,
      receiverUserId,
      'call:accepted',
      acceptedPayload,
    );

    client.emit('call:accept-confirmed', acceptedPayload);

    return acceptedPayload;
  }

  @SubscribeMessage('call:reject')
  rejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RejectCallPayload,
  ) {
    const registeredUserId = this.getRegisteredUserId(client);

    if (!registeredUserId) {
      return this.emitError(
        client,
        'NOT_REGISTERED',
        'Register the socket before rejecting a call.',
      );
    }

    const callId = this.normalizeValue(payload?.callId);
    const callerUserId = this.normalizeValue(payload?.callerUserId);
    const receiverUserId = this.normalizeValue(payload?.receiverUserId);
    const reason =
      this.normalizeValue(payload?.reason) || 'The call was rejected.';

    if (!callId || !callerUserId || !receiverUserId) {
      return this.emitError(
        client,
        'INVALID_PAYLOAD',
        'Call ID, caller user ID and receiver user ID are required.',
      );
    }

    if (registeredUserId !== receiverUserId) {
      return this.emitError(
        client,
        'UNAUTHORIZED_ACTION',
        'Only the call receiver can reject this call.',
      );
    }

    const ringingCall = this.ringingCalls.get(callId);

    if (!ringingCall) {
      return this.emitError(
        client,
        'CALL_NOT_FOUND',
        'This call is no longer ringing.',
      );
    }

    if (
      ringingCall.callerUserId !== callerUserId ||
      ringingCall.recipientUserId !== receiverUserId
    ) {
      return this.emitError(
        client,
        'PARTICIPANT_MISMATCH',
        'Call participant information does not match.',
      );
    }

    this.clearRingingCall(callId);

    const rejectedPayload = {
      success: true,
      callId,
      callerUserId,
      receiverUserId,
      recipientUserId: receiverUserId,
      consultationType: ringingCall.consultationType,
      status: 'REJECTED' as const,
      reason,
      rejectedAt: new Date().toISOString(),
    };

    this.emitToCallParticipants(
      callerUserId,
      receiverUserId,
      'call:rejected',
      rejectedPayload,
    );

    client.emit('call:reject-confirmed', rejectedPayload);

    return rejectedPayload;
  }

  @SubscribeMessage('call:cancel')
  cancelCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CancelCallPayload,
  ) {
    const registeredUserId = this.getRegisteredUserId(client);

    if (!registeredUserId) {
      return this.emitError(
        client,
        'NOT_REGISTERED',
        'Register the socket before cancelling a call.',
      );
    }

    const callId = this.normalizeValue(payload?.callId);
    const callerUserId = this.normalizeValue(payload?.callerUserId);
    const recipientUserId = this.normalizeValue(payload?.recipientUserId);
    const reason =
      this.normalizeValue(payload?.reason) || 'The caller cancelled the call.';

    if (!callId || !recipientUserId) {
      return this.emitError(
        client,
        'INVALID_PAYLOAD',
        'Call ID and recipient user ID are required.',
      );
    }

    const ringingCall = this.ringingCalls.get(callId);

    if (!ringingCall) {
      return this.emitError(
        client,
        'CALL_NOT_FOUND',
        'This call is no longer ringing.',
      );
    }

    if (registeredUserId !== ringingCall.callerUserId) {
      return this.emitError(
        client,
        'UNAUTHORIZED_ACTION',
        'Only the caller can cancel this call.',
      );
    }

    if (callerUserId && callerUserId !== ringingCall.callerUserId) {
      return this.emitError(
        client,
        'IDENTITY_MISMATCH',
        'Caller user ID does not match the active call.',
      );
    }

    if (recipientUserId !== ringingCall.recipientUserId) {
      return this.emitError(
        client,
        'PARTICIPANT_MISMATCH',
        'Recipient user ID does not match the active call.',
      );
    }

    this.clearRingingCall(callId);

    const cancelledPayload = {
      success: true,
      callId,
      callerUserId: ringingCall.callerUserId,
      recipientUserId: ringingCall.recipientUserId,
      consultationType: ringingCall.consultationType,
      status: 'CANCELLED' as const,
      reason,
      cancelledAt: new Date().toISOString(),
    };

    this.emitToCallParticipants(
      ringingCall.callerUserId,
      ringingCall.recipientUserId,
      'call:cancelled',
      cancelledPayload,
    );

    client.emit('call:cancel-confirmed', cancelledPayload);

    return cancelledPayload;
  }

  /**
   * Called automatically when the receiver does not answer
   * within RING_TIMEOUT_MS.
   */
  private handleMissedCall(callId: string): void {
    const ringingCall = this.ringingCalls.get(callId);

    if (!ringingCall) {
      return;
    }

    this.clearRingingCall(callId);

    const missedPayload = {
      success: true,
      callId,
      callerUserId: ringingCall.callerUserId,
      recipientUserId: ringingCall.recipientUserId,
      consultationType: ringingCall.consultationType,
      status: 'MISSED' as const,
      reason: 'The call was not answered within 30 seconds.',
      missedAt: new Date().toISOString(),
    };

    this.emitToCallParticipants(
      ringingCall.callerUserId,
      ringingCall.recipientUserId,
      'call:missed',
      missedPayload,
    );
  }

  private hasActiveRingingCallForUser(userId: string): boolean {
    for (const ringingCall of this.ringingCalls.values()) {
      if (
        ringingCall.callerUserId === userId ||
        ringingCall.recipientUserId === userId
      ) {
        return true;
      }
    }

    return false;
  }

  private clearRingingCall(callId: string): void {
    const ringingCall = this.ringingCalls.get(callId);

    if (!ringingCall) {
      return;
    }

    clearTimeout(ringingCall.timeout);
    this.ringingCalls.delete(callId);
  }

  private getRegisteredUserId(client: Socket): string | undefined {
    return this.registeredSocketUsers.get(client.id);
  }

  private emitToCallParticipants(
    callerUserId: string,
    recipientUserId: string,
    eventName: string,
    payload: unknown,
  ): void {
    this.socketService.emitToUser(callerUserId, eventName, payload);

    if (recipientUserId !== callerUserId) {
      this.socketService.emitToUser(recipientUserId, eventName, payload);
    }
  }

  private async authenticateSocket(client: Socket): Promise<string> {
    const handshakeToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token.trim()
        : '';

    const bearerToken = this.extractBearerToken(
      client.handshake.headers.authorization,
    );

    const token = handshakeToken || bearerToken;

    if (!token) {
      throw new Error('Missing call socket access token');
    }

    /*
     * Development-only compatibility for the existing local OTP flow.
     * This path cannot execute in NODE_ENV=production.
     */
    const localIdentity = this.getLocalDevelopmentIdentity(token);

    if (localIdentity) {
      return localIdentity;
    }

    const payload = await this.supabaseJwtService.verifyAccessToken(token);

    const subject = typeof payload.sub === 'string' ? payload.sub.trim() : '';

    if (!subject) {
      throw new Error('Authenticated socket subject is missing');
    }

    return subject;
  }

  private getLocalDevelopmentIdentity(token: string): string | null {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.LOCAL_OTP_ENABLED !== 'true'
    ) {
      return null;
    }

    const localCustomerPrefix = 'local-dev-token:';

    if (token.startsWith(localCustomerPrefix)) {
      const identity = token.slice(localCustomerPrefix.length).trim();

      return identity || null;
    }

    if (token === 'local-astrologer-token') {
      return 'seed-astrologer-supabase-id';
    }

    return null;
  }

  private extractBearerToken(
    authorization: string | string[] | undefined,
  ): string {
    const rawAuthorization = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (typeof rawAuthorization !== 'string') {
      return '';
    }

    const normalizedAuthorization = rawAuthorization.trim();

    if (!normalizedAuthorization.toLowerCase().startsWith('bearer ')) {
      return '';
    }

    return normalizedAuthorization.slice(7).trim();
  }
  private normalizeConsultationType(
    value?: ConsultationType,
  ): ConsultationType {
    return value === 'VIDEO' ? 'VIDEO' : 'AUDIO';
  }

  private normalizeValue(value?: string | null): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private emitError(client: Socket, code: CallErrorCode, message: string) {
    const errorPayload = {
      success: false,
      code,
      message,
      occurredAt: new Date().toISOString(),
    };

    client.emit('call:error', errorPayload);

    return errorPayload;
  }
}
