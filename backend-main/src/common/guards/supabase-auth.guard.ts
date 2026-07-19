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
    // Routes marked with @Public() do not require authentication.
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined =
      request.headers.authorization;

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
     * This token is accepted only when:
     * 1. The application is not running in production.
     * 2. LOCAL_OTP_ENABLED is explicitly true.
     * 3. The token exactly matches local-dev-token.
     *
     * It must never work in production.
     */
    if (this.isValidLocalDevelopmentToken(token)) {
      const localPayload: JWTPayload = {
        sub: 'local-supabase-user',
        aud: 'authenticated',
        role: 'authenticated',
        phone: request.headers['x-local-phone'],
        iss: 'astro-soul-path-local-auth',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60,
      };

      request.user = localPayload;

      this.logger.debug(
        'Local development authentication successful',
      );

      return true;
    }

    try {
      const payload =
        await this.supabaseJwtService.verifyAccessToken(token);

      if (!payload.sub) {
        this.logger.warn(
          'Authentication failed: JWT subject is missing',
        );

        throw new UnauthorizedException(
          'Invalid token claims',
        );
      }

      request.user = payload;

      this.logger.debug(
        `Supabase authentication successful for user ${payload.sub}`,
      );

      return true;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      this.logger.warn(
        `Supabase authentication failed: ${message}`,
      );

      throw new UnauthorizedException('Invalid token');
    }
  }

  private isValidLocalDevelopmentToken(
    token: string,
  ): boolean {
    const isProduction =
      process.env.NODE_ENV === 'production';

    const isLocalOtpEnabled =
      process.env.LOCAL_OTP_ENABLED === 'true';

    return (
      !isProduction &&
      isLocalOtpEnabled &&
      token === 'local-dev-token'
    );
  }
}