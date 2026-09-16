import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JWTPayload } from 'jose';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseJwtService: SupabaseJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();



    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn(
        'Authentication failed: missing or malformed authorization header',
      );

      throw new UnauthorizedException(
        'Missing or malformed authorization header',
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    /*
     * Local development authentication
     * --------------------------------
     * These local tokens work only when:
     * 1. NODE_ENV is not production.
     * 2. LOCAL_OTP_ENABLED is true.
     *
     * local-dev-token:
     *   customer/admin local user
     *
     * local-astrologer-token:
     *   astrologer local user
     *
     * These tokens must never work in production.
     */
    const localSupabaseId = this.getLocalDevelopmentSupabaseId(token);

    if (localSupabaseId) {
      const localPayload: JWTPayload = {
        sub: localSupabaseId,
        aud: 'authenticated',
        role: 'authenticated',
        phone: request.headers['x-local-phone'],
        iss: 'astro-soul-path-local-auth',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      };

      request.user = localPayload;

      this.logger.debug(
        `Local development authentication successful for ${localSupabaseId}`,
      );

      return true;
    }

    try {
      const payload = await this.supabaseJwtService.verifyAccessToken(token);

      if (!payload.sub) {
        this.logger.warn('Authentication failed: JWT subject is missing');

        throw new UnauthorizedException('Invalid token claims');
      }

      request.user = payload;

      this.logger.debug(
        `Supabase authentication successful for user ${payload.sub}`,
      );

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Supabase authentication failed: ${message}`);

      throw new UnauthorizedException('Invalid token');
    }
  }

  private getLocalDevelopmentSupabaseId(token: string): string | null {
    const isProduction = process.env.NODE_ENV === 'production';

    const isLocalOtpEnabled = process.env.LOCAL_OTP_ENABLED === 'true';

    if (isProduction || !isLocalOtpEnabled) {
      return null;
    }

    const localDevTokenPrefix = 'local-dev-token:';

    if (token.startsWith(localDevTokenPrefix)) {
      const localSupabaseId = token.slice(localDevTokenPrefix.length);

      return localSupabaseId || null;
    }

    if (token === 'local-astrologer-token') {
      return 'seed-astrologer-supabase-id';
    }

    return null;
  }
}
