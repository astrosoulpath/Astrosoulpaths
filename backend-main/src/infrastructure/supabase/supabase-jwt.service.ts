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

  private readonly issuer: string;
  private readonly audience?: string;
  private readonly jwks;
  private readonly legacyJwtSecret?: Uint8Array;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.normalizeSupabaseUrl(
      this.configService.getOrThrow<string>('supabase.url'),
    );

    this.issuer = `${supabaseUrl}/auth/v1`;

    this.audience =
      this.configService.get<string>('supabase.jwtAudience') || 'authenticated';

    /*
     * Modern Supabase projects use asymmetric signing keys.
     * Public verification keys are obtained from JWKS.
     */
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );

    /*
     * Optional fallback for projects still issuing
     * legacy HS256 Supabase JWTs.
     *
     * This MUST be the real Supabase legacy JWT secret.
     * Never use a made-up development secret for real
     * Supabase access tokens.
     */
    const legacySecret = this.configService
      .get<string>('supabase.jwtSecret')
      ?.trim();

    this.legacyJwtSecret = legacySecret
      ? new TextEncoder().encode(legacySecret)
      : undefined;
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    const normalizedToken = token?.trim();

    if (!normalizedToken) {
      throw new UnauthorizedException('Missing access token');
    }

    const header = this.decodeHeader(normalizedToken);

    if (__DEV_LOG_ENABLED()) {
      this.logger.debug(
        `jwt.verify_start alg=${header.alg ?? 'unknown'} kid=${header.kid ?? 'none'}`,
      );
    }

    /*
     * Tokens with a kid are normally modern asymmetric
     * Supabase JWTs. Verify against Supabase JWKS.
     */
    if (header.kid) {
      return this.verifyUsingJwks(normalizedToken);
    }

    /*
     * Legacy Supabase access tokens commonly use HS256
     * and may not contain a kid.
     */
    if (typeof header.alg === 'string' && header.alg.startsWith('HS')) {
      return this.verifyLegacyToken(normalizedToken);
    }

    /*
     * Unknown/no-kid token:
     * try JWKS first rather than silently trusting it.
     */
    try {
      return await this.verifyUsingJwks(normalizedToken);
    } catch {
      if (this.legacyJwtSecret) {
        return this.verifyLegacyToken(normalizedToken);
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async verifyUsingJwks(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      this.assertRequiredClaims(payload);

      this.logger.debug(`jwt.verify_success mode=jwks sub=${payload.sub}`);

      return payload;
    } catch (error) {
      const message = this.errorMessage(error);

      this.logger.warn(`jwt.verify_jwks_failed reason=${message}`);

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async verifyLegacyToken(token: string): Promise<JWTPayload> {
    if (!this.legacyJwtSecret) {
      this.logger.warn(
        'jwt.verify_legacy_failed reason=legacy_secret_not_configured',
      );

      throw new UnauthorizedException('Invalid access token');
    }

    try {
      const { payload } = await jwtVerify(token, this.legacyJwtSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256', 'HS384', 'HS512'],
      });

      this.assertRequiredClaims(payload);

      this.logger.debug(`jwt.verify_success mode=legacy sub=${payload.sub}`);

      return payload;
    } catch (error) {
      const message = this.errorMessage(error);

      this.logger.warn(`jwt.verify_legacy_failed reason=${message}`);

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private assertRequiredClaims(payload: JWTPayload): void {
    if (!payload.sub) {
      throw new UnauthorizedException('Token subject is missing');
    }

    if (!payload.exp) {
      throw new UnauthorizedException('Token expiration is missing');
    }

    if (payload.role && payload.role !== 'authenticated') {
      throw new UnauthorizedException('Invalid authentication role');
    }
  }

  private decodeHeader(token: string) {
    try {
      return decodeProtectedHeader(token);
    } catch {
      throw new UnauthorizedException('Malformed access token');
    }
  }

  private normalizeSupabaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

function __DEV_LOG_ENABLED(): boolean {
  return process.env.NODE_ENV !== 'production';
}
