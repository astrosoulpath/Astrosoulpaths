import { notificationLocalDate } from './notification-local-date';
import { SMART_CATEGORIES, SmartCategory } from './smart-astrology.catalog';
import { HOROSCOPE_LOCALES } from '../subscription/horoscope-localization';

/** Pure preflight only. A future worker must reserve frequency atomically and
 * recheck these inputs from durable records immediately before sending. */
export interface SmartDeliveryPolicyInput {
  now: Date;
  enabled: boolean;
  policyApproved: boolean;
  activeAccount: boolean;
  category: SmartCategory;
  consent: { category: SmartCategory; granted: boolean; birthUse: boolean; expiresAt: Date } | null;
  requiresBirthData: boolean;
  entitled: boolean;
  locale: string;
  contentLocale: string;
  timezone: string;
  quietHours: { startMinute: number; endMinute: number };
  dailyLimit: number;
  minimumIntervalMs: number;
  recentAttempts: Date[]; // Include accepted AND uncertain sends across all categories/devices.
}

export function evaluateSmartDelivery(input: SmartDeliveryPolicyInput): { allowed: boolean; reason: string } {
  const deny = (reason: string) => ({ allowed: false, reason });
  if (!input.enabled || !input.policyApproved) return deny('POLICY_DISABLED');
  if (!SMART_CATEGORIES.some(category => category.id === input.category)) return deny('INVALID_CATEGORY');
  if (!input.activeAccount || !input.entitled) return deny('ACCOUNT_OR_ENTITLEMENT');
  const now = input.now.getTime();
  const consent = input.consent;
  if (!Number.isFinite(now) || !consent || !consent.granted || consent.category !== input.category ||
      !Number.isFinite(consent.expiresAt.getTime()) || consent.expiresAt.getTime() <= now ||
      (input.requiresBirthData && !consent.birthUse)) return deny('CONSENT_REQUIRED');
  if (!(HOROSCOPE_LOCALES as readonly string[]).includes(input.locale) || input.locale !== input.contentLocale) return deny('LOCALE_MISMATCH');
  const { startMinute: start, endMinute: end } = input.quietHours;
  if (![start, end].every(n => Number.isInteger(n) && n >= 0 && n < 1440) || start === end ||
      !Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 10 ||
      !Number.isFinite(input.minimumIntervalMs) || input.minimumIntervalMs < 3600000)
    return deny('INVALID_FREQUENCY_POLICY');
  let day: string;
  let minute: number;
  try {
    day = notificationLocalDate(input.timezone, input.now);
    if (/^-?\d+(?:\.\d+)?$/.test(input.timezone.trim())) {
      const local = new Date(now + Number(input.timezone) * 3600000);
      minute = local.getUTCHours() * 60 + local.getUTCMinutes();
    } else {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: input.timezone.trim(), hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(input.now);
      minute = Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value);
    }
    if (input.recentAttempts.some(at => !Number.isFinite(at.getTime()) || at.getTime() > now)) return deny('INVALID_DELIVERY_HISTORY');
    if (input.recentAttempts.filter(at => notificationLocalDate(input.timezone, at) === day).length >= input.dailyLimit)
      return deny('DAILY_LIMIT');
  } catch { return deny('INVALID_TIMEZONE_OR_HISTORY'); }
  if (start < end ? minute >= start && minute < end : minute >= start || minute < end) return deny('QUIET_HOURS');
  if (input.recentAttempts.some(at => now - at.getTime() < input.minimumIntervalMs)) return deny('MINIMUM_INTERVAL');
  return { allowed: true, reason: 'PREFLIGHT_ONLY_ATOMIC_RESERVATION_REQUIRED' };
}
