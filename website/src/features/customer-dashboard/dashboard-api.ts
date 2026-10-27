import { publicAuthBase, sessionCandidate } from '@/features/auth/public-auth';
export type Row = Record<string, unknown>;
export const obj = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
export type FreeOffer = {
    eligible: boolean;
    minutes: number;
};
export function freeOffer(session: Row): FreeOffer {
    const user = obj(session.user), free = obj(user.freeChat);
    return { eligible: session.success === true && session.portal === 'customer' && session.role === 'CUSTOMER' && user.portal === 'customer' && free.eligible === true && free.used === false && free.showPopup === true && Number.isInteger(free.minutes) && Number(free.minutes) > 0, minutes: Number.isInteger(free.minutes) ? Number(free.minutes) : 0 };
}
export function owner() { const candidate = sessionCandidate('/dashboard'); if (!candidate || candidate.portal !== 'customer')
    throw Error('CUSTOMER_LOGIN_REQUIRED'); return candidate; }
export async function dashboardRequest(path: string, signal: AbortSignal, body?: Row) {
    if (!['/user/session?portal=customer', '/wallet', '/consultations/summary', '/consultations/history?page=1&limit=5', '/consultations/start'].includes(path) || (body !== undefined && path !== '/consultations/start'))
        throw Error('Unsupported dashboard operation');
    const before = owner();
    const response = await fetch(publicAuthBase() + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + before.token, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: 'omit', cache: 'no-store' });
    const result = obj(await response.json().catch(() => null));
    if (owner().snapshot !== before.snapshot)
        throw Error('SESSION_CHANGED');
    if (!response.ok || result.success !== true)
        throw Error(response.status === 401 || response.status === 403 ? 'This Customer session is not authorized. Sign in or refresh your eligibility.' : 'Information is unavailable. Check your connection and retry.');
    return result;
}
export async function customerSession(signal: AbortSignal) { const s = await dashboardRequest('/user/session?portal=customer', signal); if (s.portal !== 'customer' || s.role !== 'CUSTOMER' || obj(s.user).portal !== 'customer' || typeof obj(s.user).id !== 'string')
    throw Error('CUSTOMER_LOGIN_REQUIRED'); return s; }
const pending = new Set<string>();
export async function requestFreeChat(astrologerUserId: string, signal: AbortSignal, onSubmitting: () => void = () => {}) {
    if (!astrologerUserId.trim())
        throw Error('Select an available astrologer');
    const before = owner();
    if (pending.has(before.snapshot))
        throw Error('A request is already in progress');
    pending.add(before.snapshot);
    try {
        const session = await customerSession(signal), offer = freeOffer(session);
        if (!offer.eligible)
            throw Error('Free Chat is no longer available. No paid session was requested.');
        onSubmitting();
        const response = await dashboardRequest('/consultations/start', signal, { astrologerUserId, purchasedMinutes: offer.minutes, mode: 'chat', requireFreeChat: true });
        const call = obj(obj(response.data).call);
        if (call.isFreeChat !== true || Number(call.amountCharged) !== 0 || typeof call.id !== 'string' || call.userId !== obj(session.user).id)
            throw Error('Unable to confirm a free request. Check My Consultations before trying again.');
        return call;
    }
    finally {
        pending.delete(before.snapshot);
    }
}
export const promotions = [
    { id: 'free', title: 'Free Chat', detail: 'Your first conversation, with your verified offer.', href: '#free-chat' },
    { id: 'love', title: 'Love & Relationship', detail: 'Explore relationship guidance with an astrologer.', href: '/astrologers?expertise=Love' },
    { id: 'career', title: 'Career & Finance', detail: 'Explore perspectives, without guaranteed outcomes.', href: '/astrologers?expertise=Career' },
    { id: 'daily', title: 'Daily Horoscope', detail: 'A moment of reflection for your day.', href: '/horoscope' },
    { id: 'remedies', title: 'Personalized Remedies', detail: 'Explore supported remedies and owned Kundli guidance.', href: '/remedies' },
    { id: 'kundli', title: 'Personal Kundli', detail: 'Open your available Kundli reports and features.', href: '/kundli' },
] as const;
export function visiblePromotions(eligible: boolean) { return promotions.filter(p => p.id !== 'free' || eligible); }
export function money(value: unknown, currency: unknown) { return typeof value === 'number' && Number.isFinite(value) && typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value) : 'Unavailable'; }
