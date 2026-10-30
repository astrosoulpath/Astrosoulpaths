import {
  DAY_MS,
  EXPIRY_PRODUCTS,
  expiryEventId,
  expiryMilestone,
  expirySchedulerEnabled,
  validSubscriptionPeriod,
  withinReminderHours,
} from './subscription-expiry.policy';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { SubscriptionExpiryWorker } from './subscription-expiry.worker';

describe('role-specific subscription expiry', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  afterEach(() => {
    delete process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY;
    delete process.env.SUBSCRIPTION_EXPIRY_SCHEDULER_ENABLED;
  });
  test.each([0, 1, 2, 3, 4, 5, 6, 7])(
    'milestone %i uses exact elapsed days',
    (days) => {
      expect(
        expiryMilestone(new Date(now.getTime() + days * DAY_MS), now),
      ).toBe(days);
    },
  );
  it('never catches up stale milestones or sends before seven days', () => {
    expect(
      expiryMilestone(new Date(now.getTime() + 7 * DAY_MS + 1), now),
    ).toBeNull();
    expect(expiryMilestone(new Date(now.getTime() - DAY_MS), now)).toBeNull();
    expect(expiryMilestone(new Date(now.getTime() - 1), now)).toBe(0);
  });
  test.each(['CUSTOMER', 'ASTROLOGER'] as const)(
    'validates %s exact price, currency and duration',
    (role) => {
      const product = EXPIRY_PRODUCTS[role],
        s = {
          startDate: now,
          endDate: new Date(now.getTime() + product.days * DAY_MS),
          amount: product.price,
          currency: product.currency,
        };
      expect(validSubscriptionPeriod(s, role)).toBe(true);
      expect(
        validSubscriptionPeriod(
          { ...s, endDate: new Date(s.endDate.getTime() + 1) },
          role,
        ),
      ).toBe(false);
      expect(validSubscriptionPeriod({ ...s, amount: 0 }, role)).toBe(false);
      expect(
        validSubscriptionPeriod(
          { ...s, currency: role === 'CUSTOMER' ? 'INR' : 'USD' },
          role,
        ),
      ).toBe(false);
    },
  );
  it('deduplication changes after renewal and isolates roles', () => {
    const id = expiryEventId('s', now, 'CUSTOMER', 7);
    expect(expiryEventId('s', now, 'CUSTOMER', 7)).toBe(id);
    expect(
      expiryEventId('s', new Date(now.getTime() + DAY_MS), 'CUSTOMER', 7),
    ).not.toBe(id);
    expect(expiryEventId('s', now, 'ASTROLOGER', 7)).not.toBe(id);
  });
  it('respects IANA timezone, overnight quiet hours and DST', () => {
    expect(
      withinReminderHours(
        new Date('2026-10-30T18:00:00Z'),
        'Asia/Kolkata',
        22,
        8,
      ),
    ).toBe(false);
    expect(
      withinReminderHours(
        new Date('2026-10-30T12:00:00Z'),
        'Asia/Kolkata',
        22,
        8,
      ),
    ).toBe(true);
    expect(
      withinReminderHours(
        new Date('2026-11-01T05:30:00Z'),
        'America/New_York',
        22,
        8,
      ),
    ).toBe(false);
    expect(withinReminderHours(now, 'UTC', 8, 8)).toBe(true);
  });
  it('does not touch storage or providers when disabled', async () => {
    const db = { $queryRaw: jest.fn() },
      push = { sendSubscriptionReminder: jest.fn() };
    expect(expirySchedulerEnabled()).toBe(false);
    await new SubscriptionExpiryWorker(db as any, push as any).tick();
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(push.sendSubscriptionReminder).not.toHaveBeenCalled();
  });
  it('requires canonical ID, selected role, active account and approved astrologer', async () => {
    const user = {
      id: 'canonical',
      role: { name: 'ASTROLOGER' },
      isActive: true,
      isBlocked: false,
      isAstrologer: true,
      astrologer: { isApproved: true },
    };
    const db = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const service = new SubscriptionExpiryService(db as any);
    await expect(
      service.owner({ asp_user_id: 'canonical', asp_context: 'astrologer' }),
    ).resolves.toMatchObject({ id: 'canonical', role: 'ASTROLOGER' });
    await expect(
      service.owner({ asp_user_id: 'canonical', asp_context: 'customer' }),
    ).rejects.toThrow();
    await expect(
      service.owner({ asp_context: 'astrologer' }),
    ).rejects.toThrow();
    user.astrologer.isApproved = false;
    await expect(
      service.owner({ asp_user_id: 'canonical', asp_context: 'astrologer' }),
    ).rejects.toThrow();
    user.isBlocked = true;
    await expect(
      service.owner({ asp_user_id: 'canonical', asp_context: 'astrologer' }),
    ).rejects.toThrow();
  });
  it('does not query missing reminder tables before schema activation', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c',
          isActive: true,
          isBlocked: false,
          isAstrologer: false,
          role: { name: 'USER' },
        }),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn(),
    };
    const result = await new SubscriptionExpiryService(db as any).summary({
      asp_user_id: 'c',
      asp_context: 'CUSTOMER',
    });
    expect(result.data.subscription).toBeNull();
    expect(result.data.unreadCount).toBe(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects invalid consent/quiet hours before writes', async () => {
    process.env.SUBSCRIPTION_EXPIRY_SCHEMA_READY = 'true';
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c',
          isActive: true,
          isBlocked: false,
          isAstrologer: false,
          role: { name: 'CUSTOMER' },
        }),
      },
      $executeRaw: jest.fn(),
    };
    const service = new SubscriptionExpiryService(db as any),
      identity = { asp_user_id: 'c', asp_context: 'CUSTOMER' };
    await expect(
      service.preferences(identity, {
        pushEnabled: 'true',
        timezone: 'UTC',
        quietStart: 22,
        quietEnd: 8,
      }),
    ).rejects.toThrow();
    await expect(
      service.preferences(identity, {
        pushEnabled: true,
        timezone: 'invalid/zone',
        quietStart: 22,
        quietEnd: 8,
      }),
    ).rejects.toThrow();
    await expect(
      service.preferences(identity, {
        pushEnabled: true,
        timezone: 'UTC',
        quietStart: -1,
        quietEnd: 8,
      }),
    ).rejects.toThrow();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
