export type Portal = 'customer' | 'seller';
export type Product = { id: string; name: string; shortDescription?: string; description?: string; currency?: string; sellingPrice?: string | number; displaySellingPrice?: string; displayCurrency?: string; stock?: number; status?: string; images?: {url?: string; imageUrl?: string}[] };
export type ApiResult<T> = { success: boolean; data: T; pagination?: { hasMore?: boolean } };

export function marketplaceBase(value = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!value) throw new Error('Marketplace API is not configured.');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Unsafe marketplace API configuration.');
  return value.replace(/\/+$/, '');
}
function tokenFor(portal: Portal) {
  return localStorage.getItem(portal === 'seller' ? 'asp_astrologer_access_token' : 'asp_access_token');
}
/** Account-switch fenced; no Admin-token fallback or automatic mutation retry. */
export async function marketplaceRequest<T>(path: string, portal?: Portal, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!/^\/marketplace(?:\/|$)/.test(path) || path.includes('..') || path.includes('\\') || /[\r\n]/.test(path)) throw new Error('Invalid marketplace destination.');
  const base = marketplaceBase();
  const destination = new URL(base + path);
  if (destination.hash || !destination.pathname.startsWith(new URL(base).pathname.replace(/\/$/, '') + '/marketplace')) throw new Error('Invalid marketplace destination.');
  const token = portal ? tokenFor(portal) : null;
  if (portal && !token) throw new Error(`Sign in with your ${portal === 'seller' ? 'Astrologer' : 'Customer'} account first.`);
  const headers = new Headers(init.headers);
  headers.delete('Authorization');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(destination.toString(), {...init, headers, cache: 'no-store', credentials: 'omit', signal: init.signal ?? AbortSignal.timeout(15000)});
  const result = await response.json().catch(() => null);
  if (portal && tokenFor(portal) !== token) throw new Error('Account changed. Reload this screen.');
  if (response.status === 401) throw new Error('Session expired. Sign in again.');
  if (response.status === 403) throw new Error('This account is not authorized for this marketplace action.');
  if (!response.ok || result?.success !== true) throw new Error('Marketplace request failed. Refresh to verify its status before retrying a change.');
  return result;
}
export function marketplaceMoney(value: unknown, currency: string | undefined) {
  if (!currency || !/^[A-Z]{3}$/.test(currency) || value === null || value === undefined || !Number.isFinite(Number(value))) return 'Price unavailable';
  try { return new Intl.NumberFormat('en-IN', {style: 'currency', currency}).format(Number(value)); } catch { return 'Price unavailable'; }
}
