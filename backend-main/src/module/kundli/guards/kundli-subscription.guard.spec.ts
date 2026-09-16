import { ForbiddenException } from '@nestjs/common';

import { KundliSubscriptionGuard } from './kundli-subscription.guard';

describe('KundliSubscriptionGuard', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const makeContext = (sub = 'supabase-user-1') =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub,
          },
        }),
      }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects normal customer from professional Kundli generation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'customer-1',
      isActive: true,
      isBlocked: false,
      isAstrologer: false,
      astrologer: null,
      subscriptions: [],
    });

    const guard = new KundliSubscriptionGuard(prismaMock as any);

    await expect(guard.canActivate(makeContext())).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ASTROLOGER_ACCESS_REQUIRED',
      }),
    });
  });

  it('rejects astrologer without Kundli subscription', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-astrologer-1',
      isActive: true,
      isBlocked: false,
      isAstrologer: true,

      astrologer: {
        id: 'astrologer-1',
        isApproved: true,
        isVerified: true,
      },

      subscriptions: [],
    });

    const guard = new KundliSubscriptionGuard(prismaMock as any);

    await expect(guard.canActivate(makeContext())).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'KUNDLI_SUBSCRIPTION_REQUIRED',
      }),
    });
  });

  it('allows approved subscribed astrologer and attaches scoped access context', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-astrologer-1',
      isActive: true,
      isBlocked: false,
      isAstrologer: true,

      astrologer: {
        id: 'astrologer-1',
        isApproved: true,
        isVerified: true,
      },

      subscriptions: [
        {
          id: 'subscription-1',
          subscriptionStatus: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        },
      ],
    });

    const request: any = {
      user: {
        sub: 'supabase-astrologer-1',
      },
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };

    const guard = new KundliSubscriptionGuard(prismaMock as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.kundliAccess).toEqual({
      userId: 'user-astrologer-1',
      astrologerId: 'astrologer-1',
      subscriptionId: 'subscription-1',
      planName: 'ASTROLOGER_KUNDLI_YEARLY',
    });
  });
});
