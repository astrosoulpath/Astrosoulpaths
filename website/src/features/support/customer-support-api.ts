export type SupportRecord = Record<string, unknown>;
export const record = (value: unknown): SupportRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as SupportRecord : {};
export const string = (value: unknown): string => typeof value === 'string' ? value : '';
export const array = (value: unknown): SupportRecord[] => Array.isArray(value) ? value.map(record) : [];
export const CATEGORIES: Record<string, string> = {GENERAL: 'General help', ACCOUNT: 'Account', WALLET: 'Wallet', PAYMENT: 'Payments & refunds', CONSULTATION: 'Chat & audio consultations', ASTROLOGER: 'Astrologer assistance', TECHNICAL: 'Technical issues', OTHER: 'Other'};
export const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
export function supportSession(): string {
  try {
    const raw = localStorage.getItem('asp_user');
    if (record(JSON.parse(raw || '{}')).portal !== 'customer') throw Error();
    const token = localStorage.getItem('asp_customer_access_token') || localStorage.getItem('asp_access_token');
    if (!token) throw Error();
    return JSON.stringify([token, raw]);
  } catch {throw new Error('Sign in with your Customer account to use private support.');}
}
export function supportBase(value = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!value) throw Error('Support API is not configured.');
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw Error('Unsafe support API configuration.');
  return value.replace(/\/+$/, '');
}
export async function customerSupportRequest(path: string, init: RequestInit = {}): Promise<SupportRecord> {
  const route = path.split('?')[0], method = init.method || 'GET';
  const publicRead = route === '/support/public/help' && method === 'GET';
  const tickets = /^\/support\/tickets(?:\/[a-zA-Z0-9-]{1,120}(?:\/(messages|attachments))?)?$/.test(route);
  const assistant = /^\/support\/assistant\/(config|health|conversations(?:\/[a-zA-Z0-9-]{1,120}(?:\/(messages|escalate))?)?)$/.test(route);
  if ((!publicRead && !tickets && !assistant) || /[\\#\r\n]/.test(path) || !['GET', 'POST'].includes(method) || (method === 'POST' && (/\/(config|health)$/.test(route) || route === '/support/public/help'))) throw Error('Invalid support operation.');
  const owner = publicRead ? '' : supportSession();
  const headers = new Headers({Accept: 'application/json'});
  if (owner) headers.set('Authorization', `Bearer ${JSON.parse(owner)[0]}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const timeout = AbortSignal.timeout(30000), signal = init.signal ? AbortSignal.any([timeout, init.signal]) : timeout;
  const response = await fetch(supportBase() + path, {...init, headers, signal, credentials: 'omit', cache: 'no-store'});
  const body = record(await response.json().catch(() => null));
  if (owner && supportSession() !== owner) throw Error('Your account changed. Reopen support.');
  if (response.status === 401) throw Error('Your session expired. Sign in again.');
  if (response.status === 403) throw Error('This Customer session is not authorized for support. Sign in with an authorized Customer context.');
  if (response.status === 429) throw Error('Support request limit reached. Wait before trying again.');
  if (!response.ok || body.success === false || !Object.keys(body).length) throw Error(method === 'GET' ? 'Support is unavailable. Check your connection and retry.' : 'This change was not confirmed. Refresh your records before retrying; no success is assumed.');
  return body;
}
const types: Record<string, string> = {jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain'};
export function supportAttachment(file: File): FormData {
  const type = types[file.name.split('.').pop()?.toLowerCase() || ''];
  if (!type || file.size < 1 || file.size > 10 * 1024 * 1024 || (file.type && file.type !== type && !(type === 'image/jpeg' && file.type === 'image/jpg'))) throw Error('Use a non-empty JPG, PNG, WEBP, GIF, PDF, DOC, DOCX or TXT file up to 10 MB.');
  const form = new FormData(); form.append('file', new File([file], file.name, {type})); return form;
}
export function attachmentLink(value: unknown): string | null {
  try {const url = new URL(string(value)); return !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) ? url.toString() : null;} catch {return null;}
}
