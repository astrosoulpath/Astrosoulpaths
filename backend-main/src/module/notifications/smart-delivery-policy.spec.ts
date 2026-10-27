import { evaluateSmartDelivery, SmartDeliveryPolicyInput } from './smart-delivery-policy';

describe('disabled smart delivery policy preparation', () => {
  const input = (): SmartDeliveryPolicyInput => ({ now: new Date('2026-03-09T16:00:00Z'), enabled: true, policyApproved: true,
    activeAccount: true, category: 'love', consent: { category: 'love', granted: true, birthUse: true, expiresAt: new Date('2026-04-01Z') },
    requiresBirthData: true, entitled: true, locale: 'fr', contentLocale: 'fr', timezone: 'America/New_York',
    quietHours: { startMinute: 1320, endMinute: 480 }, dailyLimit: 2, minimumIntervalMs: 3600000, recentAttempts: [] });
  it('returns a preflight decision, never provider authorization', () => {
    expect(evaluateSmartDelivery(input())).toEqual({ allowed: true, reason: 'PREFLIGHT_ONLY_ATOMIC_RESERVATION_REQUIRED' });
  });
  it.each(['enabled', 'policyApproved', 'activeAccount', 'entitled'] as const)('denies missing %s', key => {
    const data = input(); data[key] = false; expect(evaluateSmartDelivery(data).allowed).toBe(false);
  });
  it.each(['missing', 'revoked', 'expired', 'foreign-category', 'birth-purpose'])('denies %s consent', kind => {
    const data = input();
    if (kind === 'missing') data.consent = null;
    if (kind === 'revoked') data.consent!.granted = false;
    if (kind === 'expired') data.consent!.expiresAt = data.now;
    if (kind === 'foreign-category') data.consent!.category = 'career';
    if (kind === 'birth-purpose') data.consent!.birthUse = false;
    expect(evaluateSmartDelivery(data).reason).toBe('CONSENT_REQUIRED');
  });
  it('does not substitute English content for the saved locale', () => {
    const data = input(); data.contentLocale = 'en'; expect(evaluateSmartDelivery(data).reason).toBe('LOCALE_MISMATCH');
  });
  it('rejects unknown runtime categories and unsupported locale pairs', () => {
    const data = input(); data.category = 'unreviewed' as never;
    expect(evaluateSmartDelivery(data).reason).toBe('INVALID_CATEGORY');
    data.category = 'love'; data.locale = data.contentLocale = 'unknown';
    expect(evaluateSmartDelivery(data).reason).toBe('LOCALE_MISMATCH');
  });
  it.each(['2026-03-09T02:00:00Z', '2026-03-09T11:59:00Z'])('respects midnight-spanning DST quiet hours at %s', instant => {
    const data = input(); data.now = new Date(instant); expect(evaluateSmartDelivery(data).reason).toBe('QUIET_HOURS');
  });
  it('supports fractional fixed offsets and exact quiet-hour end', () => {
    const data = input(); data.timezone = '5.75'; data.now = new Date('2026-03-09T02:15:00Z');
    expect(evaluateSmartDelivery(data).allowed).toBe(true);
  });
  it('limits all category/device attempts including uncertain outcomes', () => {
    const data = input(); data.recentAttempts = [new Date('2026-03-09T13:00Z'), new Date('2026-03-09T14:00Z')];
    expect(evaluateSmartDelivery(data).reason).toBe('DAILY_LIMIT');
  });
  it('preserves minimum spacing across a local-day boundary', () => {
    const data = input(); data.quietHours = { startMinute: 60, endMinute: 120 }; data.now = new Date('2026-03-10T04:15Z');
    data.recentAttempts = [new Date('2026-03-10T03:55Z')]; expect(evaluateSmartDelivery(data).reason).toBe('MINIMUM_INTERVAL');
  });
  it.each(['timezone', 'future', 'limit', 'interval', 'quiet'])('fails closed on malformed %s', kind => {
    const data = input();
    if (kind === 'timezone') data.timezone = 'invalid';
    if (kind === 'future') data.recentAttempts = [new Date('2027-01-01Z')];
    if (kind === 'limit') data.dailyLimit = 0;
    if (kind === 'interval') data.minimumIntervalMs = 0;
    if (kind === 'quiet') data.quietHours.endMinute = data.quietHours.startMinute;
    expect(evaluateSmartDelivery(data).allowed).toBe(false);
  });
});
