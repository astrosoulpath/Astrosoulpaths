import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JWTPayload } from 'jose';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SupabaseJwtService } from '../../infrastructure/supabase/supabase-jwt.service';
import { UserService } from '../../module/user/user.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseJwtService: SupabaseJwtService,
    private readonly userService: UserService,
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
      throw new UnauthorizedException(
        'Missing or malformed authorization header',
      );
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    /*
     * Development-only local auth remains unchanged.
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

      await this.userService.assertActiveAccount(localSupabaseId);
      request.user = localPayload;

      return true;
    }

    /*
     * FIRST: existing Supabase authentication.
     * Google/email/current users continue exactly as before.
     */
    try {
      const payload = await this.supabaseJwtService.verifyAccessToken(token);

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid token claims');
      }

      await this.userService.assertActiveAccount(payload.sub as string);

      request.user = payload;

      this.logger.debug(
        `Supabase authentication successful for user ${payload.sub}`,
      );

      return true;
    } catch {
      // Not a valid Supabase JWT.
      // Only now try Firebase Phone Auth.
    }

    /*
     * SECOND: Firebase Phone Auth.
     *
     * Important:
     * Controllers currently expect request.user.sub to be the
     * canonical user's Supabase ID. Therefore Firebase UID must
     * NOT be exposed as sub.
     */
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
      const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

      if (!projectId || !clientEmail || !privateKeyRaw) {
        throw new Error('Firebase Admin credentials missing');
      }

      const firebaseApp =
        getApps().length > 0
          ? getApps()[0]
          : initializeApp({
              credential: cert({
                projectId,
                clientEmail,
                privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
              }),
            });

      const decoded = await getAuth(firebaseApp).verifyIdToken(token, true);

      const firebaseUid = decoded.uid?.trim();

      const phone =
        typeof decoded.phone_number === 'string'
          ? decoded.phone_number.trim()
          : '';

      if (!firebaseUid || !phone || !phone.startsWith('+')) {
        throw new Error('Firebase verified phone identity missing');
      }

      /*
       * This method already performs canonical identity resolution:
       * existing phone -> existing user
       * Firebase identity -> same user
       * new phone -> new customer
       */
      const result = await this.userService.syncFirebasePhoneUser({
        firebaseUid,
        phone,
      });

      const canonicalSupabaseId = result.user.supabaseId?.trim();

      if (!canonicalSupabaseId) {
        throw new Error('Canonical user has no Supabase identity');
      }

      const firebasePayload: JWTPayload = {
        sub: canonicalSupabaseId,
        aud: 'authenticated',
        role: 'authenticated',
        phone,
        iss: `https://securetoken.google.com/${projectId}`,
        firebaseUid,
      };

      await this.userService.assertActiveAccount(canonicalSupabaseId);

      request.user = firebasePayload;

      this.logger.debug(
        `Firebase phone authentication successful for canonical user ${result.user.id}`,
      );

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Authentication failed for both Supabase and Firebase: ${message}`,
      );

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
