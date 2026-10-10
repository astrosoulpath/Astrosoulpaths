// ACCOUNT_LINK_REAL_SERVICE_TEST_V1
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
}));

import { UserService } from './user.service';

describe('Account linking - real UserService', () => {
  const prisma: any = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const service = new UserService(prisma, {} as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires explicit confirmation before linking', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken')
      .mockResolvedValue({
        phone: '+919999999999',
        firebaseUid: 'firebase-test-uid',
      });

    jest.spyOn(service as any, 'resolveCanonicalUserId')
      .mockResolvedValue('google-user-id');

    jest.spyOn(service, 'inspectAccountLinkSafety')
      .mockResolvedValue({
        userId: 'google-user-id',
        requiresManualReview: false,
        checks: {} as any,
      });

    prisma.user.findFirst.mockResolvedValue({
      id: 'phone-user-id',
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'google-user-id',
      phone: null,
      isActive: true,
      isBlocked: false,
    });

    await expect(
      service.linkFirebaseVerifiedProfilePhone(
        'google-supabase-id',
        'verified-firebase-token',
        false,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'PHONE_ACCOUNT_LINK_REQUIRED',
      },
    });

    expect(prisma.user.findFirst).toHaveBeenCalled();
  });

  // ACCOUNT_LINK_ASSET_TEST_V1
  it('blocks linking when Google account has existing assets', async () => {
    jest.spyOn(service, 'verifyFirebaseProfilePhoneToken')
      .mockResolvedValue({
        phone: '+919999999999',
        firebaseUid: 'firebase-test-uid',
      });

    jest.spyOn(service as any, 'resolveCanonicalUserId')
      .mockResolvedValue('google-user-id');

    jest.spyOn(service, 'inspectAccountLinkSafety')
      .mockResolvedValue({
        userId: 'google-user-id',
        requiresManualReview: true,
        checks: {
          hasWalletValue: true,
          subscriptions: 1,
          paymentOrders: 1,
          savedKundlis: 1,
          kundliOrders: 0,
          walletLedger: 1,
          chatMessages: 0,
          callSessions: 0,
          marketplaceOrders: 0,
          aiConversations: 0,
        },
      });

    prisma.user.findFirst.mockResolvedValue({
      id: 'phone-user-id',
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'google-user-id',
      phone: null,
      isActive: true,
      isBlocked: false,
    });

    await expect(
      service.linkFirebaseVerifiedProfilePhone(
        'google-supabase-id',
        'verified-firebase-token',
        true,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ACCOUNT_LINK_MANUAL_REVIEW',
      },
    });

    expect(prisma.user.findFirst).toHaveBeenCalled();
  });
  // ACCOUNT_LINK_IDENTITY_CONFLICT_TEST_V1
  it('rejects a Firebase UID belonging to another account', async () => {
    const previousFlag = process.env.ACCOUNT_LINKING_ENABLED;
    process.env.ACCOUNT_LINKING_ENABLED = 'true';

    try {
      jest.spyOn(service, 'verifyFirebaseProfilePhoneToken')
        .mockResolvedValue({
          phone: '+919999999999',
          firebaseUid: 'firebase-third-party-uid',
        });

      jest.spyOn(service as any, 'resolveCanonicalUserId')
        .mockResolvedValue('google-user-id');

      jest.spyOn(service, 'inspectAccountLinkSafety')
        .mockResolvedValue({
          userId: 'google-user-id',
          requiresManualReview: false,
          checks: {} as any,
        });

      prisma.user.findFirst.mockResolvedValue({
        id: 'phone-user-id',
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'google-user-id',
        phone: null,
        isActive: true,
        isBlocked: false,
      });

      const zero = { isZero: () => true };

      const tx: any = {
        wallet: {
          findUnique: jest.fn().mockResolvedValue({
            balance: zero,
            paidBalance: zero,
            freeBalance: zero,
            lockedBalance: zero,
          }),
        },
        subscription: { count: jest.fn().mockResolvedValue(0) },
        paymentOrder: { count: jest.fn().mockResolvedValue(0) },
        kundliSavedRecord: { count: jest.fn().mockResolvedValue(0) },
        kundliOrder: { count: jest.fn().mockResolvedValue(0) },
        walletLedger: { count: jest.fn().mockResolvedValue(0) },
        chatMessage: { count: jest.fn().mockResolvedValue(0) },
        callSession: { count: jest.fn().mockResolvedValue(0) },
        marketplaceOrder: { count: jest.fn().mockResolvedValue(0) },
        aiAstroConversation: { count: jest.fn().mockResolvedValue(0) },
        user: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'phone-user-id',
              phone: '+919999999999',
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            })
            .mockResolvedValueOnce({
              id: 'google-user-id',
              phone: null,
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            }),
        },
        userAuthIdentity: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'google-identity-id',
              userId: 'google-user-id',
            })
            .mockResolvedValueOnce({
              userId: 'third-party-user-id',
            }),
          update: jest.fn(),
          create: jest.fn(),
        },
      };

      prisma.$transaction = jest.fn(
        async (callback: (tx: any) => Promise<any>) => callback(tx),
      );

      await expect(
        service.linkFirebaseVerifiedProfilePhone(
          'google-supabase-id',
          'verified-firebase-token',
          true,
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'ACCOUNT_LINK_PHONE_IDENTITY_CONFLICT',
        },
      });

      expect(tx.userAuthIdentity.update).not.toHaveBeenCalled();
      expect(tx.userAuthIdentity.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ACCOUNT_LINKING_ENABLED;
      } else {
        process.env.ACCOUNT_LINKING_ENABLED = previousFlag;
      }
    }
  });
  // ACCOUNT_LINK_CANONICAL_SUCCESS_TEST_V1
  it('links Google identity to canonical phone account without modifying assets', async () => {
    const previousFlag = process.env.ACCOUNT_LINKING_ENABLED;
    process.env.ACCOUNT_LINKING_ENABLED = 'true';

    try {
      jest.spyOn(service, 'verifyFirebaseProfilePhoneToken')
        .mockResolvedValue({
          phone: '+919999999999',
          firebaseUid: 'firebase-phone-uid',
        });

      jest.spyOn(service as any, 'resolveCanonicalUserId')
        .mockResolvedValue('google-user-id');

      jest.spyOn(service, 'inspectAccountLinkSafety')
        .mockResolvedValue({
          userId: 'google-user-id',
          requiresManualReview: false,
          checks: {} as any,
        });

      prisma.user.findFirst.mockResolvedValue({
        id: 'phone-user-id',
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'google-user-id',
        phone: null,
        isActive: true,
        isBlocked: false,
      });

      const zero = { isZero: () => true };

      const tx: any = {
        wallet: {
          findUnique: jest.fn().mockResolvedValue({
            balance: zero,
            paidBalance: zero,
            freeBalance: zero,
            lockedBalance: zero,
          }),
          update: jest.fn(),
        },
        subscription: { count: jest.fn().mockResolvedValue(0) },
        paymentOrder: { count: jest.fn().mockResolvedValue(0) },
        kundliSavedRecord: { count: jest.fn().mockResolvedValue(0) },
        kundliOrder: { count: jest.fn().mockResolvedValue(0) },
        walletLedger: { count: jest.fn().mockResolvedValue(0) },
        chatMessage: { count: jest.fn().mockResolvedValue(0) },
        callSession: { count: jest.fn().mockResolvedValue(0) },
        marketplaceOrder: { count: jest.fn().mockResolvedValue(0) },
        aiAstroConversation: { count: jest.fn().mockResolvedValue(0) },
        user: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'phone-user-id',
              phone: '+919999999999',
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            })
            .mockResolvedValueOnce({
              id: 'google-user-id',
              phone: null,
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            }),
          update: jest.fn(),
        },
        userAuthIdentity: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'google-identity-id',
              userId: 'google-user-id',
            })
            .mockResolvedValueOnce(null),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };

      prisma.$transaction = jest.fn(
        async (callback: (tx: any) => Promise<any>) => callback(tx),
      );

      const result = await service.linkFirebaseVerifiedProfilePhone(
        'google-supabase-id',
        'verified-firebase-token',
        true,
      );

      expect(result.data.canonicalUserId).toBe('phone-user-id');
      expect(result.data.accountLinked).toBe(true);

      expect(tx.userAuthIdentity.update).toHaveBeenCalledWith({
        where: { id: 'google-identity-id' },
        data: { userId: 'phone-user-id' },
      });

      expect(tx.userAuthIdentity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'phone-user-id',
          provider: 'firebase',
          providerUserId: 'firebase-phone-uid',
        }),
      });

      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'Serializable' }),
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ACCOUNT_LINKING_ENABLED;
      } else {
        process.env.ACCOUNT_LINKING_ENABLED = previousFlag;
      }
    }
  });  // PHONE_OWNER_CANONICAL_ASSET_LINK_TEST_V2
  it('preserves phone owner assets while linking Google identity', async () => {
    const previousFlag = process.env.ACCOUNT_LINKING_ENABLED;
    process.env.ACCOUNT_LINKING_ENABLED = 'true';

    try {
      jest.spyOn(service, 'verifyFirebaseProfilePhoneToken')
        .mockResolvedValue({
          phone: '+919999999999',
          firebaseUid: 'firebase-phone-uid',
        });

      jest.spyOn(service as any, 'resolveCanonicalUserId')
        .mockResolvedValue('google-user-id');

      const safety = jest.spyOn(service, 'inspectAccountLinkSafety')
        .mockImplementation(async (_supabaseId, userId) => ({
          userId: userId ?? 'google-user-id',
          requiresManualReview: userId === 'phone-user-id',
          checks: {} as any,
        }));

      prisma.user.findFirst.mockResolvedValue({
        id: 'phone-user-id',
      });

      prisma.user.findUnique.mockResolvedValue({
        id: 'google-user-id',
        phone: null,
        isActive: true,
        isBlocked: false,
      });

      const zero = { isZero: () => true };

      const tx: any = {
        wallet: {
          findUnique: jest.fn().mockResolvedValue({
            balance: zero,
            paidBalance: zero,
            freeBalance: zero,
            lockedBalance: zero,
          }),
          update: jest.fn(),
        },
        subscription: { count: jest.fn().mockResolvedValue(0) },
        paymentOrder: { count: jest.fn().mockResolvedValue(0) },
        kundliSavedRecord: { count: jest.fn().mockResolvedValue(0) },
        kundliOrder: { count: jest.fn().mockResolvedValue(0) },
        walletLedger: { count: jest.fn().mockResolvedValue(0) },
        chatMessage: { count: jest.fn().mockResolvedValue(0) },
        callSession: { count: jest.fn().mockResolvedValue(0) },
        marketplaceOrder: { count: jest.fn().mockResolvedValue(0) },
        aiAstroConversation: { count: jest.fn().mockResolvedValue(0) },
        user: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'phone-user-id',
              phone: '+919999999999',
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            })
            .mockResolvedValueOnce({
              id: 'google-user-id',
              phone: null,
              isActive: true,
              isBlocked: false,
              role: { name: 'CUSTOMER' },
            }),
          update: jest.fn(),
        },
        userAuthIdentity: {
          findUnique: jest.fn()
            .mockResolvedValueOnce({
              id: 'google-identity-id',
              userId: 'google-user-id',
            })
            .mockResolvedValueOnce(null),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };

      prisma.$transaction = jest.fn(
        async (callback: (tx: any) => Promise<any>) => callback(tx),
      );

      const result = await service.linkFirebaseVerifiedProfilePhone(
        'google-supabase-id',
        'verified-firebase-token',
        true,
      );

      expect(result.data.accountLinked).toBe(true);
      expect(result.data.canonicalUserId).toBe('phone-user-id');

      expect(tx.userAuthIdentity.update).toHaveBeenCalledWith({
        where: { id: 'google-identity-id' },
        data: { userId: 'phone-user-id' },
      });

      expect(tx.wallet.update).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();

      expect(safety).toHaveBeenCalledWith('google-supabase-id');
      expect(safety).not.toHaveBeenCalledWith('', 'phone-user-id');
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ACCOUNT_LINKING_ENABLED;
      } else {
        process.env.ACCOUNT_LINKING_ENABLED = previousFlag;
      }
    }
  });
  // REAL_PHONE_OWNER_ASSET_QUERY_TEST_V1
  it('detects phone-owner Kundli through actual asset queries', async () => {
    const db: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'phone-user-id',
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      subscription: { count: jest.fn().mockResolvedValue(0) },
      paymentOrder: { count: jest.fn().mockResolvedValue(0) },
      kundliSavedRecord: { count: jest.fn().mockResolvedValue(1) },
      kundliOrder: { count: jest.fn().mockResolvedValue(0) },
      walletLedger: { count: jest.fn().mockResolvedValue(0) },
      chatMessage: { count: jest.fn().mockResolvedValue(0) },
      callSession: { count: jest.fn().mockResolvedValue(0) },
      marketplaceOrder: { count: jest.fn().mockResolvedValue(0) },
      aiAstroConversation: { count: jest.fn().mockResolvedValue(0) },
    };

    const realService = new UserService(db, {} as any);

    const result = await realService.inspectAccountLinkSafety(
      '',
      'phone-user-id',
    );

    expect(result.userId).toBe('phone-user-id');
    expect(result.requiresManualReview).toBe(true);
    expect(result.checks.savedKundlis).toBe(1);

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'phone-user-id' },
    });

    expect(db.kundliSavedRecord.count).toHaveBeenCalledWith({
      where: { customerUserId: 'phone-user-id' },
    });
  });

  // GOOGLE_RELOGIN_CANONICAL_REGRESSION_V1
  it('resolves linked Google identity to original phone account', async () => {
    const db: any = {
      userAuthIdentity: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'phone-user-id',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'phone-user-id',
          supabaseId: 'phone-original-supabase-id',
          phone: '+919999999999',
          email: null,
          name: 'Original Phone Customer',
          isActive: true,
          isBlocked: false,
        }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const realService = new UserService(db, {} as any);

    const user = await realService.getUserWithRelations(
      'google-supabase-id',
    );

    expect(user?.id).toBe('phone-user-id');
    expect(user?.supabaseId).toBe('phone-original-supabase-id');
    expect(user?.name).toBe('Original Phone Customer');

    expect(db.userAuthIdentity.findUnique).toHaveBeenCalledWith({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: 'google-supabase-id',
        },
      },
      select: { userId: true },
    });

    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'phone-user-id' },
      }),
    );

    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  // SYNC_USER_UNVERIFIED_IDENTITY_REGRESSION_V1
  describe('syncUser unknown identity collision protection', () => {
    const createSyncService = (ownerLookup: 'email' | 'phone') => {
      const db: any = {
        role: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'customer-role-id',
            name: 'CUSTOMER',
          }),
        },
        subscriptionPlan: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'free-plan-id',
            name: 'FREE',
          }),
        },
        userAuthIdentity: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        user: {
          findUnique: jest.fn().mockImplementation(({ where }: any) => {
            if (
              ownerLookup === 'email' &&
              where.email === 'owner@example.com'
            ) {
              return Promise.resolve({ id: 'original-phone-account' });
            }

            if (
              ownerLookup === 'phone' &&
              where.phone === '+919999999999'
            ) {
              return Promise.resolve({ id: 'original-phone-account' });
            }

            return Promise.resolve(null);
          }),
          update: jest.fn(),
          create: jest.fn(),
        },
      };

      const syncService = new UserService(db, {} as any);

      return { db, syncService };
    };

    it('blocks unknown Google identity matching an existing email', async () => {
      const { db, syncService } = createSyncService('email');

      await expect(
        syncService.syncUser({
          supabaseId: 'unknown-google-supabase-id',
          email: 'owner@example.com',
        }),
      ).rejects.toThrow(
        'An account already uses these details. Verify ownership before linking.',
      );

      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
    });

    it('blocks unknown identity matching an existing phone', async () => {
      const { db, syncService } = createSyncService('phone');

      await expect(
        syncService.syncUser({
          supabaseId: 'unknown-supabase-id',
          phone: '+919999999999',
        }),
      ).rejects.toThrow(
        'An account already uses these details. Verify ownership before linking.',
      );

      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.userAuthIdentity.create).not.toHaveBeenCalled();
    });
  });
});
