import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
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

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
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

    /*
     * Backward compatibility is intentional:
     *
     * 1. Existing Supabase access tokens continue to work.
     * 2. If Supabase verification fails, try Firebase Auth.
     * 3. Firebase UID is resolved through UserAuthIdentity.
     * 4. Downstream code receives the canonical ASP/Supabase subject.
     *
     * This means HTTP guards and existing Chat / Call / Live gateways
     * can continue consuming payload.sub without changing their
     * authorization/business logic.
     */
    try {
      return await this.verifySupabaseAccessToken(normalizedToken);
    } catch (supabaseError) {
      try {
        return await this.verifyFirebaseAccessToken(normalizedToken);
      } catch (firebaseError) {
        const supabaseMessage = this.errorMessage(supabaseError);
        const firebaseMessage = this.errorMessage(firebaseError);

        this.logger.warn(
          `auth.verify_failed supabase=${supabaseMessage} firebase=${firebaseMessage}`,
        );

        throw new UnauthorizedException('Invalid access token');
      }
    }
  }

  private async verifySupabaseAccessToken(
    normalizedToken: string,
  ): Promise<JWTPayload> {
    const header = this.decodeHeader(normalizedToken);

    if (__DEV_LOG_ENABLED()) {
      this.logger.debug(
        `jwt.verify_start alg=${header.alg ?? 'unknown'} kid=${header.kid ?? 'none'}`,
      );
    }

    if (header.kid) {
      return this.verifyUsingJwks(normalizedToken);
    }

    if (typeof header.alg === 'string' && header.alg.startsWith('HS')) {
      return this.verifyLegacyToken(normalizedToken);
    }

    try {
      return await this.verifyUsingJwks(normalizedToken);
    } catch {
      if (this.legacyJwtSecret) {
        return this.verifyLegacyToken(normalizedToken);
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async verifyFirebaseAccessToken(token: string): Promise<JWTPayload> {
    const app = this.getFirebaseAdminApp();

    const decoded = await getAuth(app).verifyIdToken(token, true);

    const firebaseUid = decoded.uid?.trim();

    if (!firebaseUid) {
      throw new UnauthorizedException('Firebase UID is missing');
    }

    const identity = await this.prismaService.userAuthIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'firebase',
          providerUserId: firebaseUid,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            supabaseId: true,
            phone: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const user = identity?.user;

    if (!user?.supabaseId?.trim()) {
      throw new UnauthorizedException(
        'Firebase identity is not linked to an Astro Soul Path account',
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const payload: JWTPayload = {
      sub: user.supabaseId.trim(),
      aud: 'authenticated',
      role: 'authenticated',
      iss: `firebase:${decoded.iss ?? 'firebase-auth'}`,
      iat: decoded.iat ?? now,
      exp: decoded.exp,
      phone:
        typeof decoded.phone_number === 'string'
          ? decoded.phone_number
          : (user.phone ?? undefined),
      email:
        typeof decoded.email === 'string'
          ? decoded.email
          : (user.email ?? undefined),
      firebase_uid: firebaseUid,
      asp_user_id: user.id,
      asp_account_role: user.role,
      auth_provider: 'firebase',
    };

    if (!payload.exp) {
      throw new UnauthorizedException('Firebase token expiration is missing');
    }

    this.logger.debug(
      `jwt.verify_success mode=firebase uid=${firebaseUid} canonicalSub=${payload.sub}`,
    );

    return payload;
  }

  private getFirebaseAdminApp(): App {
    const existingApp = getApps()[0];

    if (existingApp) {
      return existingApp;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(
      /\\n/g,
      '\n',
    ).trim();

    if (!projectId || !clientEmail || !privateKey) {
      throw new UnauthorizedException(
        'Firebase Admin configuration is incomplete',
      );
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
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
