import { publicAuthBase, sessionCandidate, verifyNavigationSession } from '../auth/public-auth';
export type SubscriptionRole = 'CUSTOMER' | 'ASTROLOGER';
export type SubscriptionReminderState = {
  ownerId: string; roleContext: SubscriptionRole; serverNow: string; schemaReady: boolean;
  product: {title: string; price: string; currency: string; days: number; renewal: string};
  subscription: {id: string; status: string; startDate: string|null; expiresAt: string|null; periodVerified: boolean; automaticRenewal: false}|null;
  preference: {pushEnabled: boolean; timezone: string; quietStart: number; quietEnd: number};
  unreadCount: number;
  reminders: {id: string; title: string; body: string; readAt: string|null; createdAt: string; expiresAt: string; milestone: number}[];
};
export function subscriptionPath(role: SubscriptionRole) { return role === 'CUSTOMER' ? '/notifications' : '/astrologer/notifications'; }
export async function subscriptionRequest(role: SubscriptionRole, signal: AbortSignal, path = '', body?: unknown): Promise<SubscriptionReminderState|null> {
  const origin = subscriptionPath(role);
  const identity = await verifyNavigationSession(origin, signal);
  const candidate = sessionCandidate(origin);
  if (!identity || !candidate || identity.portal.toUpperCase() !== role) throw Error('Sign in to the correct account to view reminders.');
  const snapshot = candidate.snapshot;
  const response = await fetch(publicAuthBase() + '/notifications/subscriptions' + path, {
    method: body === undefined ? 'GET' : 'PATCH', credentials: 'omit', cache: 'no-store',
    headers: {Authorization: 'Bearer ' + candidate.token, ...(body === undefined ? {} : {'Content-Type':'application/json'})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
  });
  if (sessionCandidate(origin)?.snapshot !== snapshot || signal.aborted) throw Error('Account changed. Reopen notifications.');
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) throw Error('Subscription reminders are temporarily unavailable. Please retry.');
  if (path.endsWith('/read')) return null;
  if (result.data?.ownerId !== identity.id || result.data?.roleContext !== role || !Array.isArray(result.data.reminders) || !Number.isInteger(result.data.unreadCount)) throw Error('Subscription response could not be verified.');
  return result.data;
}
export function subscriptionProgress(state: SubscriptionReminderState, now = Date.parse(state.serverNow)) {
  const end = Date.parse(state.subscription?.expiresAt || ''), start = Date.parse(state.subscription?.startDate || '');
  if (![now,end,start].every(Number.isFinite) || end <= start) return null;
  return {days: Math.max(0,Math.ceil((end-now)/86400000)), progress: Math.max(0,Math.min(1,(end-now)/(end-start))), expiry: new Date(end)};
}
