import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
} from 'jose';

@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly jwks;
  private readonly issuer: string;
  private readonly jwtSecret?: Uint8Array;
  private readonly audience?: string;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.normalizeSupabaseUrl(
      this.configService.getOrThrow<string>('supabase.url'),
    );
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
    const jwtSecret = this.configService.get<string | undefined>(
      'supabase.jwtSecret',
    );
    this.jwtSecret = jwtSecret
      ? new TextEncoder().encode(jwtSecret)
      : undefined;
    this.audience = this.configService.get<string | undefined>(
      'supabase.jwtAudience',
    );
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing socket token');
    }

    const header = this.tryDecodeHeader(token);
    this.logger.debug(
      `socket_jwt.verify_start alg=${header.alg ?? 'unknown'} kid=${header.kid ?? 'none'} tokenLength=${token.length}`,
    );

    const verificationOptions = {
      issuer: this.issuer,
      ...(this.audience ? { audience: this.audience } : {}),
    };

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        ...verificationOptions,
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token claims');
      }

      this.logger.debug(
        `socket_jwt.verify_success mode=jwks sub=${payload.sub} aud=${this.stringifyAudience(payload.aud)}`,
      );

      return payload;
    } catch (jwksError) {
      const jwksMessage =
        jwksError instanceof Error ? jwksError.message : String(jwksError);
      this.logger.warn(`socket_jwt.verify_jwks_failed reason=${jwksMessage}`);

      if (!this.jwtSecret) {
        throw new UnauthorizedException(`Invalid token: ${jwksMessage}`);
      }
    }

    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        ...verificationOptions,
        algorithms: ['HS256', 'HS384', 'HS512'],
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token claims');
      }

      this.logger.debug(
        `socket_jwt.verify_success mode=secret sub=${payload.sub} aud=${this.stringifyAudience(payload.aud)}`,
      );

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`socket_jwt.verify_failed reason=${message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(`Invalid token: ${message}`);
    }
  }

  private normalizeSupabaseUrl(url: string) {
    return url.replace(/\/+$/, '');
  }

  private tryDecodeHeader(token: string) {
    try {
      return decodeProtectedHeader(token);
    } catch {
      return {};
    }
  }

  private stringifyAudience(audience: JWTPayload['aud']) {
    if (Array.isArray(audience)) {
      return audience.join(',');
    }

    return audience ?? 'missing';
  }
}
