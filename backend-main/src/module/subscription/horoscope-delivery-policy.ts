import { createHash } from 'node:crypto';
import { notificationLocalMinute } from '../notifications/notification-local-date';

// Code readiness only: enabling this gate is NOT legal/operator policy approval.
export function horoscopeDeliveryPolicyEnabled(): boolean {
  return process.env.HOROSCOPE_REMINDER_POLICY_ENABLED === 'true';
}

export function horoscopeDailyDeliveryKey(userId: string, localDate: string) {
  return createHash('sha256')
    .update(JSON.stringify(['horoscope-customer-day-v1', userId, localDate]))
    .digest('hex');
}

/** Proposed quiet hours: [22:00, 08:00), including retry delivery boundaries. */
export function horoscopeQuietHours(
  timezone: string,
  at = new Date(),
): boolean {
  const minute = notificationLocalMinute(timezone, at);
  return minute < 8 * 60 || minute >= 22 * 60;
}

/** Find the next permitted minute using real IANA DST rules, not a 24h offset. */
export function nextHoroscopeWindow(timezone: string, at: Date): Date {
  let low = Math.floor(at.getTime() / 60000);
  let high = low + 60;
  let hours = 0;
  while (horoscopeQuietHours(timezone, new Date(high * 60000))) {
    low = high;
    high += 60;
    if (++hours > 30) throw new Error('No permitted horoscope window');
  }
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (horoscopeQuietHours(timezone, new Date(mid * 60000))) low = mid;
    else high = mid;
  }
  return new Date(high * 60000);
}
