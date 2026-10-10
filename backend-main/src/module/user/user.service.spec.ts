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
  });  // PHONE_OWNER_KUNDLI_BLOCK_TEST_V1
  it('blocks linking when phone owner has an existing Kundli', async () => {
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

      prisma.$transaction = jest.fn();

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

      expect(safety).toHaveBeenCalledWith('', 'phone-user-id');
      expect(prisma.$transaction).not.toHaveBeenCalled();
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
});