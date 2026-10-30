import { ROLES_KEY } from '../decorators/roles.decorator';
import { bindAdminRequest } from '../auth/admin-identity-policy';
﻿import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
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

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (roles?.length && roles.every(role => role.toUpperCase() === 'ADMIN')) {
      await bindAdminRequest(request, token, this.userService);
      return true;
    }

    /*
     * Development-only local auth remains unchanged.
     */
    const localSupabaseId = this.getLocalDevelopmentSupabaseId(token);

    if (localSupabaseId) {
      if(/(^|\/)admin(\/|$)/i.test(String(request.originalUrl??request.url??'').split('?')[0]))throw new ForbiddenException('Admin context required');
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

      const path=String(request.originalUrl??request.url??'').split('?')[0];
      if(/(^|\/)admin(\/|$)/i.test(path)&&payload.asp_context!=='admin')throw new ForbiddenException('Admin context required');
      if(payload.asp_context){
        if(payload.asp_context==='admin')await bindAdminRequest(request,token,this.userService);
        if(/^\/(api\/)?astrologer(\/|$)/.test(path)&&payload.asp_context!=='astrologer'&&
          !/\/astrologer\/public(\/|$)/.test(path))throw new ForbiddenException('Astrologer context required');
        if(payload.asp_context==='astrologer'&&payload.asp_account_role==='ASTROLOGER_APPLICANT'&&
          !/^\/(api\/)?(user\/session|user\/profile|astrologer\/(register|application|kyc\/upload|onboarding-status|profile))(\/|$)/.test(path)){
          throw new ForbiddenException('Approved astrologer context required');
        }
      }

      request.user = payload;

      this.logger.debug(
        'Canonical authentication successful',
      );

      return true;
    } catch (error) {
      if(error instanceof ForbiddenException)throw error;
      if(token.startsWith('aspctx.'))throw new UnauthorizedException('Invalid context session');
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
      // Fallback may not synchronize or authorize an existing Admin identity.
      if(firebaseUid){const existing=await this.userService.getUserByFirebaseUid(firebaseUid);
        if(existing?.role?.name?.toUpperCase()==='ADMIN')throw new UnauthorizedException('Scoped session required');}

      const phone =
        typeof decoded.phone_number === 'string'
          ? decoded.phone_number.trim()
          : '';

      let result: Awaited<ReturnType<UserService['syncFirebasePhoneUser']>>;
      let email: string | undefined;

      if (firebaseUid && phone.startsWith('+')) {
        result = await this.userService.syncFirebasePhoneUser({
          firebaseUid,
          phone,
        });
      } else {
        email =
          typeof decoded.email === 'string'
            ? decoded.email.trim().toLowerCase()
            : '';

        if (!firebaseUid || !email || decoded.email_verified !== true) {
          throw new Error('Verified Firebase identity missing');
        }

        result = await this.userService.syncFirebaseEmailUser({
          firebaseUid,
          email,
        });
      }

      const canonicalSupabaseId = result.user.supabaseId?.trim();

      if (!canonicalSupabaseId) {
        throw new Error('Canonical user has no Supabase identity');
      }

      const firebasePayload: JWTPayload = {
        sub: canonicalSupabaseId,
        aud: 'authenticated',
        role: 'authenticated',
        ...(phone.startsWith('+') ? { phone } : {}),
        ...(email ? { email, email_verified: true } : {}),
        iss: `https://securetoken.google.com/${projectId}`,
        firebaseUid,
      };

      await this.userService.assertActiveAccount(canonicalSupabaseId);

      request.user = firebasePayload;

      this.logger.debug(
        'Firebase canonical authentication successful',
      );

      return true;
    } catch (error: unknown) {
      this.logger.warn('Authentication verification failed');

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
