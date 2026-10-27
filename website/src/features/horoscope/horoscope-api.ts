export const SIGNS = [
  ['aries', 'Aries', '♈'], ['taurus', 'Taurus', '♉'], ['gemini', 'Gemini', '♊'],
  ['cancer', 'Cancer', '♋'], ['leo', 'Leo', '♌'], ['virgo', 'Virgo', '♍'],
  ['libra', 'Libra', '♎'], ['scorpio', 'Scorpio', '♏'], ['sagittarius', 'Sagittarius', '♐'],
  ['capricorn', 'Capricorn', '♑'], ['aquarius', 'Aquarius', '♒'], ['pisces', 'Pisces', '♓'],
] as const;
export const LOCALES = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko', 'zh', 'ar', 'ru'] as const;
export const PERIODS = ['today', 'tomorrow', 'yesterday', 'weekly', 'monthly', 'yearly'] as const;
export type Period = typeof PERIODS[number];
export type JsonRecord = Record<string, unknown>;
export function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
export function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

export class HoroscopeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function horoscopeBase(value = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!value) throw new Error('Horoscope API is not configured.');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Unsafe Horoscope API configuration.');
  }
  return value.replace(/\/+$/, '');
}
/** Select only the active Customer portal, never an Admin/Astrologer fallback.
 * Local metadata is a client-side fence, never backend authorization proof. */
export function customerSession(): string {
  let user: JsonRecord;
  try { user = object(JSON.parse(localStorage.getItem('asp_user') || '{}')); }
  catch { throw new HoroscopeError(401, 'Sign in to the Customer website to continue.'); }
  if (user.portal !== 'customer') throw new HoroscopeError(401, 'Sign in to the Customer website to continue.');
  const token = localStorage.getItem('asp_customer_access_token') || localStorage.getItem('asp_access_token');
  if (!token) throw new HoroscopeError(401, 'Sign in to the Customer website to continue.');
  return JSON.stringify([token, localStorage.getItem('asp_user')]);
}
export function generalPath(sign: string, period: Period, locale: string, now = new Date()): string {
  const selected = SIGNS.find(item => item[0] === sign);
  if (!selected || !PERIODS.includes(period) || !LOCALES.some(item => item === locale)) throw new Error('Unsupported horoscope selection.');
  const date = new Date(now);
  // Civil day selection only. All astronomical calculations remain on the server.
  date.setDate(date.getDate() + (period === 'tomorrow' ? 1 : period === 'yesterday' ? -1 : 0));
  const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const endpoint = ['today', 'tomorrow', 'yesterday'].includes(period) ? 'daily' : period;
  return `/general-horoscope/${endpoint}?${new URLSearchParams({moonSign: selected[1], date: localDay, lang: locale})}`;
}
const privatePaths = new Set(['/dailyinsight', '/dailyinsight/history', '/subscription/current', '/subscription/cancel', '/notifications/horoscope-preference']);
/** Bounded, no-store, no automatic retry. Private replies are account-switch fenced. */
export async function horoscopeRequest(path: string, isPrivate = false, init: RequestInit = {}): Promise<JsonRecord> {
  const route = path.split('?')[0];
  if (!(isPrivate ? privatePaths.has(route) : route === '/subscription/plans' || /^\/general-horoscope\/(daily|weekly|monthly|yearly)$/.test(route)) || /[\\#\r\n]/.test(path)) throw new Error('Invalid Horoscope destination.');
  if (init.method && init.method !== 'GET' && !(isPrivate && ((route === '/notifications/horoscope-preference' && init.method === 'PATCH') || (route === '/subscription/cancel' && init.method === 'POST')))) throw new Error('Unsupported Horoscope operation.');
  const identity = isPrivate ? customerSession() : null;
  const headers = new Headers({Accept: 'application/json'});
  if (identity) headers.set('Authorization', `Bearer ${JSON.parse(identity)[0]}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(30000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(horoscopeBase() + path, {...init, headers, signal, cache: 'no-store', credentials: 'omit'});
  const result: unknown = await response.json().catch(() => null);
  if (identity && customerSession() !== identity) throw new HoroscopeError(401, 'Account changed. Reload your Horoscope.');
  if (response.status === 401) throw new HoroscopeError(401, 'Your Customer session expired. Sign in again.');
  if (response.status === 403) throw new HoroscopeError(403, 'Personalized access was denied. Check your active subscription and birth profile.');
  if (!response.ok || !result || object(result).success === false) throw new HoroscopeError(response.status, 'Horoscope is unavailable. Retry, or check your birth profile and server availability.');
  if (isPrivate && route === '/dailyinsight' && !isActiveEntitlement(object(object(result).entitlement))) throw new HoroscopeError(403, 'A verified active Daily Horoscope entitlement is required.');
  const query = new URLSearchParams(path.split('?')[1]);
  const requestedLocale = query.get(isPrivate ? 'language' : 'lang');
  if (requestedLocale && (route === '/dailyinsight' || route.startsWith('/general-horoscope/'))) {
    const returnedLocale = isPrivate ? object(object(object(object(result).data).generation).language).code : object(result).language;
    if (returnedLocale !== requestedLocale) throw new HoroscopeError(503, 'The requested reading language is unavailable. No fallback reading is displayed.');
  }
  return object(result);
}
export function planLabel(plan: JsonRecord): string {
  const amount = planPrice(plan.price);
  if (amount === null || !/^[A-Z]{3}$/.test(text(plan.currency)) || typeof plan.durationDays !== 'number') return 'Plan pricing unavailable';
  return `${new Intl.NumberFormat(undefined, {style: 'currency', currency: text(plan.currency)}).format(amount)} / ${plan.durationDays} days`;
}
function planPrice(value: unknown): number | null {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value))) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
export function isDailyOffer(plan: JsonRecord): boolean {
  return plan.name === 'DAILY_HOROSCOPE_MONTHLY' && plan.isActive === true && planPrice(plan.price) === 1 && plan.currency === 'USD' && plan.durationDays === 30;
}
export function isActiveEntitlement(entitlement: JsonRecord, now = Date.now()): boolean {
  return entitlement.planName === 'DAILY_HOROSCOPE_MONTHLY' && entitlement.status === 'ACTIVE' &&
    Date.parse(text(entitlement.startDate)) <= now && Date.parse(text(entitlement.endDate)) > now;
}
