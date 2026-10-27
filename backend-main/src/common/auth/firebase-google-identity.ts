import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

export async function verifyFirebaseGoogleIdentity(
  idToken: string,
  requireGoogleSignInProvider = true,
  allowPassword = false,
) {
  const token = idToken?.trim();

  if (!token) {
    throw new BadRequestException({
      success: false,
      message: 'Firebase ID token is required',
      code: 'FIREBASE_TOKEN_REQUIRED',
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new InternalServerErrorException({
      success: false,
      message: 'Firebase Google authentication is not configured',
      code: 'FIREBASE_NOT_CONFIGURED',
    });
  }

  const app =
    getApps().find((candidate) => candidate.options.projectId === projectId) ??
    initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      },
      `asp-google-${projectId}`,
    );

  let decoded;

  try {
    decoded = await getAuth(app).verifyIdToken(token, true);
  } catch {
    throw new UnauthorizedException({
      success: false,
      message: 'Invalid or expired Firebase Google session',
      code: 'FIREBASE_GOOGLE_TOKEN_INVALID',
    });
  }

  const uid = decoded.uid?.trim();
  const email = decoded.email?.trim().toLowerCase();
  const firebaseProvider = decoded.firebase?.sign_in_provider;

  if (decoded.aud !== projectId) {
    throw new UnauthorizedException({
      success: false,
      message: 'Firebase authentication project mismatch',
      code: 'FIREBASE_PROJECT_MISMATCH',
    });
  }

  if (!uid || !email || decoded.email_verified !== true) {
    throw new UnauthorizedException({
      success: false,
      message: 'A verified Firebase Google identity is required',
      code: 'FIREBASE_GOOGLE_EMAIL_NOT_VERIFIED',
    });
  }

  if (requireGoogleSignInProvider && firebaseProvider !== 'google.com') {
    throw new UnauthorizedException({
      success: false,
      message: 'A Google-authenticated Firebase session is required',
      code: 'FIREBASE_GOOGLE_PROVIDER_REQUIRED',
    });
  }
  if (allowPassword && !['google.com', 'password'].includes(firebaseProvider ?? '')) {
    throw new UnauthorizedException('Google or verified Email authentication required');
  }

  let firebaseUser;

  try {
    firebaseUser = await getAuth(app).getUser(uid);
  } catch {
    throw new UnauthorizedException({
      success: false,
      message: 'Firebase Google identity could not be verified',
      code: 'FIREBASE_GOOGLE_IDENTITY_INVALID',
    });
  }

  const googleProviderIdentity = firebaseUser.providerData.find(
    (provider) => provider.providerId === 'google.com',
  );
  const hasEmailPasswordProvider = firebaseUser.providerData.some(
    (provider) => provider.providerId === 'password',
  );

  const passwordProvider = firebaseUser.providerData.find(provider => provider.providerId === 'password');
  if (firebaseUser.disabled || firebaseUser.emailVerified !== true || firebaseUser.email?.trim().toLowerCase() !== email) {
    throw new UnauthorizedException('Active verified Firebase identity required');
  }
  if (!googleProviderIdentity?.uid && !(allowPassword && firebaseProvider === 'password' && passwordProvider?.email?.toLowerCase() === email)) {
    throw new UnauthorizedException({
      success: false,
      message: 'Google provider identity is missing from Firebase',
      code: 'FIREBASE_GOOGLE_IDENTITY_INVALID',
    });
  }

  return {
    uid,
    email,
    expiresAt: decoded.exp,
    googleSubject: googleProviderIdentity?.uid ?? '',
    signInProvider: firebaseProvider,
    passwordEmail: passwordProvider?.email?.trim().toLowerCase(),
    hasEmailPasswordProvider,
    firebaseUserDisabled: firebaseUser.disabled,
    googleEmail: googleProviderIdentity?.email?.trim().toLowerCase(),
    tokenGoogleSubjects: decoded.firebase?.identities?.['google.com'],
  };
}
