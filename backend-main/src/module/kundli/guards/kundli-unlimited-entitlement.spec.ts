import { ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { KundliSubscriptionGuard } from './kundli-subscription.guard';

describe('professional unlimited calculation entitlement (no endpoint activation)', () => {
  function fixture(
    overrides: Record<string, unknown> = {},
    path = '/kundli/generate',
  ) {
    const subscription = {
      id: 'synthetic-subscription',
      amount: 3500,
      currency: 'INR',
      subscriptionStatus: 'ACTIVE',
      startDate: new Date(Date.now() - 60000),
      endDate: new Date(Date.now() + 600000),
      subscriptionPlan: {
        isActive: true,
        price: 3500,
        currency: 'INR',
        durationDays: 365,
        features: { unlimitedKundliGeneration: true },
      },
      ...overrides,
    };
    const lookup = jest.fn().mockResolvedValue({
      id: 'synthetic-user',
      isActive: true,
      isBlocked: false,
      isAstrologer: true,
      astrologer: {
        id: 'synthetic-astrologer',
        isApproved: true,
        isVerified: true,
      },
      subscriptions: [subscription],
    });
    const guard = new KundliSubscriptionGuard({
      user: { findUnique: lookup },
    } as unknown as PrismaService);
    const request = {
      user: { sub: 'synthetic-subject' },
      method: 'POST',
      path,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { guard, context, lookup, request };
  }

  it('authorizes 25 repeated eligible checks without a quota or usage write', async () => {
    const { guard, context, lookup } = fixture();
    for (let i = 0; i < 25; i++)
      expect(await guard.canActivate(context)).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(25);
    const query = lookup.mock.calls[0][0];
    expect(query.select.subscriptions.where.subscriptionStatus.in).toEqual([
      'ACTIVE',
    ]);
    expect(query.select.subscriptions.where.AND).toEqual([
      { startDate: { lte: expect.any(Date) } },
      { endDate: { gt: expect.any(Date) } },
    ]);
  });

  it.each([
    { subscriptionStatus: 'EXPIRED' },
    { subscriptionStatus: 'PENDING' },
    { subscriptionStatus: 'TRIAL' },
    { subscriptionStatus: 'CANCELLED' },
    { endDate: new Date(0) },
    { endDate: null },
    { startDate: null },
    { startDate: new Date(Date.now() + 86400000) },
    { subscriptionPlan: { isActive: false } },
    { amount: 3000 },
    { currency: 'USD' },
  ])(
    'rejects new generation for invalid paid entitlement %j',
    async (overrides) => {
      const { guard, context } = fixture(overrides);
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { code: 'KUNDLI_SUBSCRIPTION_REQUIRED' },
      });
    },
  );

  it('also fences regeneration and preserves explicit Admin generation disable', async () => {
    const { guard, context } = fixture(
      {
        subscriptionPlan: {
          isActive: true,
          price: 3500,
          currency: 'INR',
          durationDays: 365,
          features: { unlimitedKundliGeneration: false },
        },
      },
      '/kundli/saved/synthetic/regenerate',
    );
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'KUNDLI_GENERATION_DISABLED' },
    });
  });
  it('preserves the existing legacy entitlement rules for saved-record reads', async () => {
    const { guard, context, lookup, request } = fixture(
      {
        subscriptionStatus: 'TRIAL',
        startDate: null,
        endDate: null,
      },
      '/kundli/saved',
    );
    request.method = 'GET';
    expect(await guard.canActivate(context)).toBe(true);
    expect(
      lookup.mock.calls[0][0].select.subscriptions.where.subscriptionStatus.in,
    ).toEqual(['ACTIVE', 'TRIAL']);
  });
  it.each([
    { isActive: false },
    { isBlocked: true },
    {
      astrologer: {
        id: 'synthetic-astrologer',
        isApproved: false,
        isVerified: true,
      },
    },
    {
      astrologer: {
        id: 'synthetic-astrologer',
        isApproved: true,
        isVerified: false,
      },
    },
  ])(
    'rejects inactive or unapproved astrologers before generation %j',
    async (change) => {
      const { guard, context, lookup } = fixture();
      lookup.mockResolvedValueOnce({
        id: 'synthetic-user',
        isActive: true,
        isBlocked: false,
        isAstrologer: true,
        astrologer: {
          id: 'synthetic-astrologer',
          isApproved: true,
          isVerified: true,
        },
        subscriptions: [],
        ...change,
      });
      await expect(guard.canActivate(context)).rejects.toThrow();
    },
  );
});
