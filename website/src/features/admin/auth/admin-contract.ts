// Shared by server and browser. Missing configuration must fail closed.
export function getAdminApiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) throw new Error("Admin API URL is not configured.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "Admin API URL must use HTTPS (HTTP is allowed only for local development).",
    );
  }
  return value.replace(/\/+$/, "");
}

export const ADMIN_SESSION_COOKIE = "asp_admin_session";
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 900,
};

export async function verifyAdminSessionToken(token: string | undefined) {
  if (!token || !token.startsWith('aspctx.') || token.length > 3800 || /\s/.test(token)) return null;
  return requestAdminSession('/auth/admin/context/verify', {accessToken:token});
}
export async function exchangeAdminFirebaseToken(token: string, method: 'google' | 'password') {
  if (!token || token.length > 8192 || /\s/.test(token)) return null;
  return requestAdminSession(`/auth/admin/firebase/${method === 'password' ? 'email' : 'google'}`, {idToken:token});
}
async function requestAdminSession(path: string, payload: object) {
  const response = await fetch(`${getAdminApiBase()}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error('Admin authorization service is unavailable.');
  const body = await response.json();
  if (body?.success !== true || body.authContext !== 'admin' || !body.accessToken?.startsWith('aspctx.') || body.adminPolicy !== 'single-google-v1' || body.role !== 'ADMIN' ||
      typeof body.user?.id !== 'string' || !body.user.id || body.user.role !== 'ADMIN') return null;
  return body as { success: true; accessToken: string; expiresIn?: number; authContext:'admin'; role: 'ADMIN'; adminPolicy: 'single-google-v1'; user: { id: string; email?: string; role: 'ADMIN'; portal: 'admin' } };
}
export async function checkAdminToken(token: string | undefined): Promise<boolean> {
  return (await verifyAdminSessionToken(token)) !== null;
}
