import { NotificationsService } from '../notifications/notifications.service';
import {
  HOROSCOPE_LOCALES,
  validateHoroscopeText,
} from './horoscope-localization';
import { horoscopeReminderCopy } from './horoscope-reminder-copy';
describe('horoscope logout ownership and non-private reminders', () => {
  function fixture() {
    const row = { userId: 'owner-A', fcmToken: 'synthetic', isActive: true };
    const db: any = {
      userAuthIdentity: {
        findUnique: jest.fn(async ({ where }) => ({
          userId: where.provider_providerUserId.providerUserId,
        })),
      },
      pushDevice: {
        upsert: jest.fn(async ({ update }) => {
          Object.assign(row, update);
          return row;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          if (where.userId === row.userId && where.fcmToken === row.fcmToken) {
            Object.assign(row, data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
    };
    return { row, db, service: new NotificationsService(db) };
  }
  it('logout unbinds only the current canonical owner and exact installation token', async () => {
    const f = fixture();
    await f.service.unregisterDevice('owner-A', 'synthetic');
    expect(f.row.isActive).toBe(false);
    expect(f.db.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'owner-A', fcmToken: 'synthetic' },
      data: { isActive: false },
    });
  });
  it('late A logout cannot deactivate a token already reassigned to B', async () => {
    const f = fixture();
    await f.service.registerDevice({
      externalUserId: 'owner-B',
      fcmToken: 'synthetic',
      platform: 'ANDROID',
    });
    await f.service.unregisterDevice('owner-A', 'synthetic');
    expect(f.row).toMatchObject({ userId: 'owner-B', isActive: true });
  });
  it('repeated logout is harmless and does not delete devices or users', async () => {
    const f = fixture();
    await f.service.unregisterDevice('owner-A', 'synthetic');
    await f.service.unregisterDevice('owner-A', 'synthetic');
    expect(f.row.userId).toBe('owner-A');
    expect(f.row.isActive).toBe(false);
  });
  it('invalid token is rejected before database access', async () => {
    const f = fixture();
    await expect(f.service.unregisterDevice('owner-A', '')).rejects.toThrow(
      'required',
    );
    expect(f.db.pushDevice.updateMany).not.toHaveBeenCalled();
  });
  it.each(HOROSCOPE_LOCALES)(
    '%s reminder is Unicode-valid and independent of private AI/profile data',
    (locale) => {
      const copy = horoscopeReminderCopy(locale);
      validateHoroscopeText(locale, [copy.body]);
      expect(copy.title).toBe('Astro Soul Path');
      expect(Buffer.from(copy.body).toString('utf8')).toBe(copy.body);
      expect(copy.body).not.toMatch(
        /synthetic-fingerprint|dateOfBirth|private-reading/,
      );
    },
  );
  it('unknown locale has no English fallback', () =>
    expect(() => horoscopeReminderCopy('xx')).toThrow());
});
