import type { Request, Response, NextFunction } from 'express';
import {
  ForbiddenException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import type { UserService } from '../../module/user/user.service';
import type { verifyFirebaseGoogleIdentity } from './firebase-google-identity';
import { verifyContextSession } from './context-session';

type Identity = Awaited<ReturnType<typeof verifyFirebaseGoogleIdentity>>;
type AdminUser = NonNullable<
  Awaited<ReturnType<UserService['getAdminByFirebaseUid']>>
>;
const proofs = new WeakMap<object, { uid: string; user: AdminUser }>();

export function readAllowedAdminUid(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const uid = env.ADMIN_ALLOWED_FIREBASE_UID;
  if (
    !uid ||
    uid.length > 128 ||
    uid !== uid.trim() ||
    /[\s,;\[\]{}"']/.test(uid)
  ) {
    throw new ForbiddenException('Admin authentication is not configured');
  }
  return uid;
}

export function rejectLegacyAdminAuthentication(): void {
  throw new ForbiddenException(
    'Admin access requires the authorized Firebase Google or linked Email identity',
  );
}

export async function authorizeAdminIdentity(
  identity: Identity,
  users: Pick<UserService, 'getAdminByFirebaseUid'>,
) {
  const allowed = readAllowedAdminUid();
  if (
    identity.uid !== allowed ||
    identity.firebaseUserDisabled ||
    (identity.signInProvider === 'password'
      ? !identity.hasEmailPasswordProvider || identity.passwordEmail !== identity.email || !identity.googleSubject
      : identity.googleEmail !== identity.email || !identity.tokenGoogleSubjects?.includes(identity.googleSubject))
  ) {
    throw new ForbiddenException('Admin identity is not authorized');
  }
  const user = await users.getAdminByFirebaseUid(identity.uid);
  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    user.role?.name?.toUpperCase() !== 'ADMIN' ||
    user.email?.trim().toLowerCase() !== identity.email
  ) {
    throw new ForbiddenException(
      'An existing active Admin mapping is required',
    );
  }
  return user;
}

export async function authorizeAdminToken(
  token: string,
  users: Pick<UserService, 'getAdminByFirebaseUid'>,
) {
  readAllowedAdminUid();
  const proof = await verifyContextSession(token, 'admin', {
    getAdminByFirebaseUid: uid => users.getAdminByFirebaseUid(uid),
    getUserByFirebaseUid: uid => users.getAdminByFirebaseUid(uid),
  });
  return { uid: proof.uid, user: proof.user };
}

export async function bindAdminRequest(
  request: object,
  token: string,
  users: Pick<UserService, 'getAdminByFirebaseUid'>,
) {
  const proof = await authorizeAdminToken(token, users);
  (request as { user?: unknown }).user = {
    sub: proof.user.supabaseId,
    firebaseUid: proof.uid,
  };
  proofs.set(request, proof);
}

export function requireAdminRequest(request: { user?: { sub?: unknown } }) {
  const proof = proofs.get(request);
  if (
    !proof ||
    proof.uid !== readAllowedAdminUid() ||
    request.user?.sub !== proof.user.supabaseId
  ) {
    throw new UnauthorizedException(
      'Verified Firebase Admin context is required',
    );
  }
  return proof.user;
}

export function createAdminHttpMiddleware(
  users: Pick<UserService, 'getAdminByFirebaseUid'>,
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      response
        .status(401)
        .json({ message: 'Google Admin authentication required' });
      return;
    }
    try {
      await bindAdminRequest(request, header.slice(7).trim(), users);
      next();
    } catch (error) {
      response
        .status(error instanceof HttpException ? error.getStatus() : 503)
        .json({ message: 'Admin access denied' });
    }
  };
}
