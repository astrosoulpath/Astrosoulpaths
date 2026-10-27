import type { Socket } from 'socket.io';
import { protectCommunicationSocket } from './communication-socket-lease';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTPayload } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseJwtService } from './supabase-jwt.service';
import { SupabaseService } from './supabase.service';

@Injectable()
export class CommunicationAuthService {
  constructor(
    private readonly jwt: SupabaseJwtService,
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async protectSocket(socket: Socket, initial?: JWTPayload): Promise<void> {
    if (!socket.connected) throw new UnauthorizedException('Communication authentication required');
    const authorization = socket.handshake.headers.authorization;
    const token = socket.handshake.auth?.token ||
      (typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '') : '');
    const payload = initial ?? await this.verify(token);
    if (!socket.connected) throw new UnauthorizedException('Communication authentication required');
    protectCommunicationSocket(socket, payload, () => this.verify(token));
  }

  async verify(token: string): Promise<JWTPayload> {
    try {
      let payload: JWTPayload;
      const local =
        this.config.get('NODE_ENV') !== 'production' &&
        this.config.get('LOCAL_OTP_ENABLED') === 'true';
      const localSubject = local
        ? token.startsWith('local-dev-token:')
          ? token.slice(16).trim()
          : token === 'local-dev-token'
            ? 'local-supabase-user'
            : token === 'local-astrologer-token'
              ? 'seed-astrologer-supabase-id'
              : ''
        : '';
      if (localSubject)
        payload = {
          sub: localSubject,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      else {
        // Existing verifier already verifies Firebase revocation and maps its UID read-only.
        payload = await this.jwt.verifyAccessToken(token);
        if (!['firebase','asp-context'].includes(String(payload.auth_provider))) {
          const { data, error } = await this.supabase
            .getClient()
            .auth.getUser(token);
          if (error || !data.user || data.user.id !== payload.sub)
            throw new Error();
        }
      }
      if (!payload.sub || !payload.exp || payload.exp <= Date.now() / 1000)
        throw new Error();
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { supabaseId: payload.sub },
            {
              authIdentities: {
                some: { provider: 'supabase', providerUserId: payload.sub },
              },
            },
          ],
        },
        include: { role: true },
        take: 2,
      });
      if (users.length !== 1) throw new Error();
      const user = users[0];
      if (
        !user.isActive ||
        user.isBlocked ||
        !['USER', 'CUSTOMER', 'ASTROLOGER', 'ADMIN'].includes(
          user.role?.name?.toUpperCase(),
        ) ||
        !user.supabaseId
      )
        throw new Error();
      if (payload.asp_user_id && payload.asp_user_id !== user.id)
        throw new Error();
      return {
        ...payload,
        sub: user.supabaseId,
        asp_user_id: user.id,
        asp_account_role: payload.asp_context ? payload.asp_account_role : user.role.name,
      };
    } catch {
      throw new UnauthorizedException('Communication authentication required');
    }
  }
}
