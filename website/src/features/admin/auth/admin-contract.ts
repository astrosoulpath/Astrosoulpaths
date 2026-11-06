// Shared by server and browser. Missing configuration must fail closed.
export function getAdminApiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) throw new Error("Admin API URL is not configured.");
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const privateHost = /^(localhost$|0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(host);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" &&
      (privateHost || (!host.includes(".") && !host.includes(":")) || [".localhost", ".local", ".internal"].some(suffix => host.endsWith(suffix)))) ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        process.env.NODE_ENV !== "production" &&
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
  if (method !== 'google' || !token || token.length > 8192 || /\s/.test(token)) return null;
  return requestAdminSession('/auth/admin/firebase/google', {idToken:token});
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
