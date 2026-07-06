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
    // Skip auth for routes decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    // Temporary JWT debugging logs. Keep masked so they are safe to remove later.
    this.logger.debug(
      `jwt_debug.header authHeader=${this.maskAuthorizationHeader(authHeader)}`,
    );
    this.logger.debug(
      'jwt_debug.secret secretExists=false secretLength=0 verificationMode=jwks',
    );

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('jwt_debug.header_invalid reason=missing_or_malformed');
      throw new UnauthorizedException(
        'Missing or malformed authorization header',
      );
    }

    const token = authHeader.slice(7);
    this.logger.debug(`jwt_debug.token tokenPreview=${this.maskToken(token)}`);

    try {
      const payload = await this.supabaseJwtService.verifyAccessToken(token);

      this.logger.debug(
        `jwt_debug.verify_success payload=${this.safeStringify(this.sanitizePayload(payload))}`,
      );

      if (!payload.sub) {
        this.logger.warn('jwt_debug.payload_invalid reason=missing_sub');
        throw new UnauthorizedException('Invalid token claims');
      }

      request.user = payload;

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`jwt_debug.verify_failed error=${message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private maskAuthorizationHeader(authHeader?: string): string {
    if (!authHeader) {
      return 'missing';
    }

    if (!authHeader.startsWith('Bearer ')) {
      return 'non-bearer';
    }

    return `Bearer ${this.maskToken(authHeader.slice(7))}`;
  }

  private maskToken(token: string): string {
    if (!token) {
      return 'missing';
    }

    if (token.length <= 12) {
      return `${token.slice(0, 2)}***${token.slice(-2)}`;
    }

    return `${token.slice(0, 6)}...${token.slice(-6)}`;
  }

  private sanitizePayload(payload: JWTPayload): Record<string, unknown> {
    const { sub, aud, role, exp, iat, iss, email, phone } = payload;

    return {
      sub,
      aud,
      role,
      exp,
      iat,
      iss,
      email,
      phone,
    };
  }

  private safeStringify(value: Record<string, unknown>): string {
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable-payload]';
    }
  }
}
