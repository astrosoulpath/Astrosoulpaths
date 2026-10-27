import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE, verifyAdminSessionToken, exchangeAdminFirebaseToken } from '@/features/admin/auth/admin-contract';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  try {
    const body = await request.json();
    const token = body?.idToken;
    if (typeof token !== 'string' || !token || token.length > 8192 || /\s/.test(token) || !['google', 'password', 'existing'].includes(body.method)) {
      return NextResponse.json({ message: 'Invalid Admin session request.' }, { status: 400 });
    }
    // Cookie verification never promotes a raw Customer/Firebase credential.
    const verified = body.method === 'existing' ? await verifyAdminSessionToken(token)
      : await exchangeAdminFirebaseToken(token, body.method);
    if (!verified) {
      const denied = NextResponse.json({ message: 'Admin session expired or access denied. Use the authorized Google account.' }, { status: 401 });
      denied.cookies.set(ADMIN_SESSION_COOKIE, '', { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
      return denied;
    }
    const response = NextResponse.json({ success: true, user: verified.user, accessToken:verified.accessToken });
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(ADMIN_SESSION_COOKIE, verified.accessToken, {...ADMIN_COOKIE_OPTIONS,maxAge:Math.min(900,verified.expiresIn??900)});
    return response;
  } catch {
    return NextResponse.json({ message: 'Google Admin authorization is unavailable on the configured backend. Please retry.' }, { status: 503 });
  }
}
export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ message: 'Invalid request origin.' }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
