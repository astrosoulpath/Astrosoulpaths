import { HoroscopeDurableStore } from './horoscope-durable.store';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsPushService } from '../notifications/notifications.push.service';
function fixture(active = true, enabled = false) {
  const plan = {
    name: 'DAILY_HOROSCOPE_MONTHLY',
    currency: 'USD',
    price: 1,
    durationDays: 30,
  };
  const db: any = {
    userAuthIdentity: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'synthetic-owner' }),
    },
    subscription: {
      findFirst: jest
        .fn()
        .mockResolvedValue(active ? { subscriptionPlan: plan } : null),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ enabled }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const push = { isConfigured: () => true } as NotificationsPushService;
  return { db, plan, service: new NotificationsService(db, push) };
}
describe('Authoritative reminder eligibility without automatic consent', () => {
  const old = { ...process.env };
  beforeEach(() => {
    process.env.HOROSCOPE_DURABLE_ENABLED = 'true';
    process.env.HOROSCOPE_SCHEMA_READY = 'true';
    process.env.HOROSCOPE_OUTBOX_ENABLED = 'true';
    process.env.HOROSCOPE_REMINDER_POLICY_ENABLED = 'true';
  });
  afterEach(() => {
    process.env = old;
  });
  it('restores existing enabled consent for an eligible subscriber without another write', async () => {
    const f = fixture(true, true);
    expect(
      (await f.service.getHoroscopePreference('subject')).data,
    ).toMatchObject({
      eligible: true,
      enabled: true,
      deliveryReady: true,
      subscriptionStatus: 'ACTIVE',
    });
    expect(f.db.$executeRaw).not.toHaveBeenCalled();
    expect(f.db.subscription.findFirst.mock.calls[0][0].where).toMatchObject({
      userId: 'synthetic-owner',
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: { name: 'DAILY_HOROSCOPE_MONTHLY', isActive: true },
      user: { isActive: true, isBlocked: false },
    });
  });
  it('never turns an opted-out subscriber on', async () => {
    const f = fixture(true, false);
    expect(
      (await f.service.getHoroscopePreference('subject')).data.enabled,
    ).toBe(false);
    expect(f.db.$executeRaw).not.toHaveBeenCalled();
  });
  it('distinguishes missing subscriptions without selecting a different product', async () => {
    const f = fixture(false);
    expect(
      (await f.service.getHoroscopePreference('subject')).data,
    ).toMatchObject({ eligible: false, subscriptionStatus: 'NONE' });
    for (const [query] of f.db.subscription.findFirst.mock.calls)
      expect(query.where.subscriptionPlan.name).toBe('DAILY_HOROSCOPE_MONTHLY');
  });
  it('expired subscription cannot enable reminders but may persist opt-out', async () => {
    const f = fixture(false, true);
    f.db.subscription.findFirst.mockImplementation(async (query) =>
      query.where.subscriptionStatus
        ? null
        : { subscriptionStatus: 'ACTIVE', endDate: new Date(0) },
    );
    expect(
      (await f.service.getHoroscopePreference('subject')).data
        .subscriptionStatus,
    ).toBe('EXPIRED');
    await expect(
      f.service.setHoroscopePreference('subject', true),
    ).rejects.toThrow('active personalized');
    expect(f.db.$executeRaw).not.toHaveBeenCalled();
    await f.service.setHoroscopePreference('subject', false);
    expect(f.db.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it('does not authorize a misconfigured price or duration', async () => {
    const f = fixture();
    f.plan.durationDays = 365;
    await expect(
      f.service.setHoroscopePreference('subject', true),
    ).rejects.toThrow('active personalized');
    expect(f.db.$executeRaw).not.toHaveBeenCalled();
  });
  it('reports a paused pipeline without discarding saved consent', async () => {
    process.env.HOROSCOPE_OUTBOX_ENABLED = 'false';
    const f = fixture(true, true);
    expect(
      (await f.service.getHoroscopePreference('subject')).data,
    ).toMatchObject({ enabled: true, eligible: true, deliveryReady: false });
  });
  it('does not call a missing Firebase configuration ready', async () => {
    const f = fixture();
    const service = new NotificationsService(f.db, {
      isConfigured: () => false,
    } as NotificationsPushService);
    expect(
      (await service.getHoroscopePreference('subject')).data.deliveryReady,
    ).toBe(false);
  });
  it('keeps missing schema fail-closed without queries', async () => {
    delete process.env.HOROSCOPE_SCHEMA_READY;
    const f = fixture();
    expect(
      (await f.service.getHoroscopePreference('subject')).data,
    ).toMatchObject({
      status: 'NOT_ACTIVATED',
      eligible: false,
      deliveryReady: false,
    });
    expect(f.db.subscription.findFirst).not.toHaveBeenCalled();
    expect(f.db.$queryRaw).not.toHaveBeenCalled();
  });
  it('uses one stable device/day delivery identity across locale and reading versions',async()=>{
    const db:any={$executeRaw:jest.fn().mockResolvedValue(1)};const store=new HoroscopeDurableStore(db);
    const reading:any={id:'reading-en',userId:'owner',subscriptionId:'sub',localDate:'2026-10-21',locale:'en'};
    await store.enqueue(reading,['device'],new Date());
    await store.enqueue({...reading,id:'reading-fr-v2',locale:'fr'},['device'],new Date());
    expect(db.$executeRaw.mock.calls[0][1]).toBe(db.$executeRaw.mock.calls[1][1]);
    expect(db.$executeRaw.mock.calls[0][0].join('')).toContain('WHERE NOT EXISTS');
    await store.enqueue({...reading,localDate:'2026-10-22'},['device'],new Date());
    expect(db.$executeRaw.mock.calls[0][1]).not.toBe(db.$executeRaw.mock.calls[2][1]);
  });

});
