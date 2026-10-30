import { ExecutionContext } from '@nestjs/common';
import { SubscriptionExpiryRateGuard } from './subscription-expiry-rate.guard';
const context = (id?: string, method = 'GET') =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: id ? { asp_user_id: id } : undefined,
        method,
      }),
    }),
  }) as ExecutionContext;
describe('expiry reminder HTTP abuse protection', () => {
  afterEach(() => jest.restoreAllMocks());
  it('rejects requests without verified canonical identity', () => {
    expect(() =>
      new SubscriptionExpiryRateGuard().canActivate(context()),
    ).toThrow();
  });
  it('allows sixty reads then returns 429', () => {
    const guard = new SubscriptionExpiryRateGuard();
    for (let i = 0; i < 60; i++)
      expect(guard.canActivate(context('a'))).toBe(true);
    expect(() => guard.canActivate(context('a'))).toThrow('Too many');
  });
  it('limits mutations independently to ten per minute', () => {
    const guard = new SubscriptionExpiryRateGuard();
    for (let i = 0; i < 10; i++) guard.canActivate(context('a', 'PATCH'));
    expect(() => guard.canActivate(context('a', 'PATCH'))).toThrow('Too many');
    expect(guard.canActivate(context('a'))).toBe(true);
  });
  it('does not let one account consume another account budget', () => {
    const guard = new SubscriptionExpiryRateGuard();
    for (let i = 0; i < 60; i++) guard.canActivate(context('a'));
    expect(guard.canActivate(context('b'))).toBe(true);
  });
  it('refills an expired window without storage writes', () => {
    let now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const guard = new SubscriptionExpiryRateGuard();
    for (let i = 0; i < 60; i++) guard.canActivate(context('a'));
    now = 60_000;
    expect(guard.canActivate(context('a'))).toBe(true);
  });
});
