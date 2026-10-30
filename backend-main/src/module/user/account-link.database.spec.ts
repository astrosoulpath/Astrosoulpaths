jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
}));
import { PrismaClient } from '@prisma/client';
import { UserService } from './user.service';

describe('Account linking - isolated PostgreSQL integration', () => {
  let prisma: PrismaClient;
  let service: UserService;

  beforeAll(async () => {
    const safety=require('../../../test/isolated-integration/account-link-safety.cjs');
    safety.validateTarget(process.env);

    // ACCOUNT_LINK_ISOLATED_TRANSACTION_GUARD_V1
    const isolatedTransactionTest =
      process.env.ACCOUNT_LINKING_ENABLED === 'true' &&
      process.env.ACCOUNT_LINK_TRANSACTION_TEST === 'true';

    if (
      process.env.ACCOUNT_LINKING_ENABLED !== 'false' &&
      !isolatedTransactionTest
    ) {
      throw new Error('Account linking must remain disabled.');
    }

    prisma = new PrismaClient();
    await prisma.$connect();
    await safety.seed(prisma,process.env);

    const supabaseService = {
      getClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'asp-test-google-supabase',
                email: 'google-test@example.invalid',
                app_metadata: { provider: 'google', providers: ['google'] },
                identities: [],
              },
            },
            error: null,
          }),
        },
      }),
    };

    service = new UserService(prisma as any, supabaseService as any);
  });

  // ACCOUNT_LINK_TEST_FIXTURE_RESET_V1
  // Only isolated test database fixtures may be modified.
  const resetGoogleFixture = async () => {
    const safety=require('../../../test/isolated-integration/account-link-safety.cjs');
    await safety.verifyTarget(prisma,process.env);

    const identity = await prisma.userAuthIdentity.findUniqueOrThrow({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: 'asp-test-google-supabase',
        },
      },
    });

    if (
      identity.userId !== 'asp-test-google-user' &&
      identity.userId !== 'asp-test-phone-user'
    ) {
      throw new Error('Fixture reset blocked: unexpected account owner');
    }

    await prisma.userAuthIdentity.update({
      where: {
        provider_providerUserId: {
          provider: 'supabase',
          providerUserId: 'asp-test-google-supabase',
        },
      },
      data: {
        userId: 'asp-test-google-user',
      },
    });
  };

  beforeEach(async () => {
    await resetGoogleFixture();
  });
  afterAll(async () => {
    try {
      if (prisma) {
        await resetGoogleFixture();
      }
    } finally {
      await prisma?.$disconnect();
    }
  });

  it('preserves phone account INR 500 wallet', async () => {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: 'asp-test-phone-user' },
    });

    expect(wallet).not.toBeNull();
    expect(wallet?.balance.toNumber()).toBe(500);
    expect(wallet?.paidBalance.toNumber()).toBe(500);
  });

  it('preserves phone account paid subscription', async () => {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: 'asp-test-phone-user',
        subscriptionStatus: 'ACTIVE',
      },
    });

    expect(subscriptions).toHaveLength(1);
  });

  it('resolves Google login to its separate account before linking', async () => {
    const user = await service.getUserWithRelations('asp-test-google-supabase');

    expect(user?.id).toBe('asp-test-google-user');
  });

  it('resolves phone login to original account', async () => {
    const user = await service.getUserWithRelations('asp-test-phone-supabase');

    expect(user?.id).toBe('asp-test-phone-user');
  });

  it('detects phone account existing assets', async () => {
    const safety = await service.inspectAccountLinkSafety(
      'asp-test-phone-supabase',
    );

    expect(safety.requiresManualReview).toBe(true);
    expect(safety.checks.hasWalletValue).toBe(true);
    expect(safety.checks.subscriptions).toBeGreaterThan(0);
  });

  it('allows asset-free Google account to proceed to consent checks', async () => {
    const safety = await service.inspectAccountLinkSafety(
      'asp-test-google-supabase',
    );

    expect(safety.requiresManualReview).toBe(false);
    expect(safety.checks.hasWalletValue).toBe(false);
  });

  // REAL_ACCOUNT_LINK_TRANSACTION_TEST_V1
  it('links Google identity to phone account without moving assets', async () => {
    const phoneUserId = 'asp-test-phone-user';
    const googleUserId = 'asp-test-google-user';

    const beforeWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: phoneUserId },
    });

    const beforeKundlis = await prisma.kundliSavedRecord.count({
      where: { customerUserId: phoneUserId },
    });

    expect(beforeWallet.balance.toNumber()).toBe(500);
    expect(beforeKundlis).toBe(1);

    const verifySpy = jest
      .spyOn(service, 'verifyFirebaseProfilePhoneToken')
      .mockResolvedValue({
        phone: '+919999999999',
        firebaseUid: 'asp-test-firebase-verified-phone',
      });

    try {
      await expect(
        service.linkFirebaseVerifiedProfilePhone(
          'asp-test-google-supabase',
          'isolated-test-firebase-token',
          false,
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'PHONE_ACCOUNT_LINK_REQUIRED',
        },
      });

      const result = await service.linkFirebaseVerifiedProfilePhone(
        'asp-test-google-supabase',
        'isolated-test-firebase-token',
        true,
      );

      expect(result).toBeDefined();

      const googleIdentity = await prisma.userAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerUserId: {
            provider: 'supabase',
            providerUserId: 'asp-test-google-supabase',
          },
        },
      });

      expect(googleIdentity.userId).toBe(phoneUserId);

      const firebaseIdentity = await prisma.userAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: 'asp-test-firebase-verified-phone',
          },
        },
      });

      expect(firebaseIdentity.userId).toBe(phoneUserId);

      const afterWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId: phoneUserId },
      });

      expect(afterWallet.balance.toNumber()).toBe(500);
      expect(afterWallet.paidBalance.toNumber()).toBe(500);

      const afterKundlis = await prisma.kundliSavedRecord.count({
        where: { customerUserId: phoneUserId },
      });

      expect(afterKundlis).toBe(1);

      const subscription = await prisma.subscription.count({
        where: {
          userId: phoneUserId,
          subscriptionStatus: 'ACTIVE',
        },
      });

      expect(subscription).toBe(1);

      const googleAccount = await prisma.user.findUniqueOrThrow({
        where: { id: googleUserId },
      });

      expect(googleAccount.subscriptionStatus).toBe('FREE');
    } finally {
      verifySpy.mockRestore();
    }
  });

  it('preserves canonical user and customer data when Google is added to an existing Firebase email UID', async () => {
    const userId = 'asp-test-phone-user';
    const firebaseUid = 'asp-test-email-google-same-uid';
    const userBefore = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });
    const [walletBefore, kundlisBefore, subscriptionsBefore, paymentsBefore] =
      await Promise.all([
        prisma.wallet.findUniqueOrThrow({ where: { userId } }),
        prisma.kundliSavedRecord.count({ where: { customerUserId: userId } }),
        prisma.subscription.count({ where: { userId } }),
        prisma.paymentOrder.count({ where: { userId } }),
      ]);

    await prisma.userAuthIdentity.create({
      data: {
        userId,
        provider: 'firebase',
        providerUserId: firebaseUid,
        identityType: 'email',
        email: userBefore.email ?? 'asp-test-customer@example.invalid',
        isPrimary: true,
      },
    });

    const linkedEmail = userBefore.email ?? 'asp-test-customer@example.invalid';

    try {
      const result = await service.syncFirebaseEmailUser({
        firebaseUid,
        email: linkedEmail,
        identityType: 'google',
      });

      expect(result.user.id).toBe(userId);

      const [walletAfter, kundlisAfter, subscriptionsAfter, paymentsAfter] =
        await Promise.all([
          prisma.wallet.findUniqueOrThrow({ where: { userId } }),
          prisma.kundliSavedRecord.count({ where: { customerUserId: userId } }),
          prisma.subscription.count({ where: { userId } }),
          prisma.paymentOrder.count({ where: { userId } }),
        ]);

      expect(walletAfter.balance.toString()).toBe(
        walletBefore.balance.toString(),
      );
      expect(walletAfter.paidBalance.toString()).toBe(
        walletBefore.paidBalance.toString(),
      );
      expect(kundlisAfter).toBe(kundlisBefore);
      expect(subscriptionsAfter).toBe(subscriptionsBefore);
      expect(paymentsAfter).toBe(paymentsBefore);

      const identity = await prisma.userAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: firebaseUid,
          },
        },
      });
      expect(identity.userId).toBe(userId);
      expect(identity.identityType).toBe('google');
    } finally {
      await prisma.userAuthIdentity.deleteMany({
        where: { provider: 'firebase', providerUserId: firebaseUid },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { email: userBefore.email },
      });
    }
  });

  it('links phone-first account to Google without moving customer assets', async () => {
    const phoneUserId = 'asp-test-phone-user';
    const googleUserId = 'asp-test-google-user';
    const firebaseUid = 'asp-test-google-link-phone-identity';
    const beforeWallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: phoneUserId },
    });

    const verifySpy = jest
      .spyOn(service, 'verifyFirebaseProfilePhoneToken')
      .mockResolvedValue({
        phone: '+919999999999',
        firebaseUid,
      });

    try {
      const result = await service.linkGoogleIdentityToVerifiedPhone(
        'isolated-test-google-token',
        'isolated-test-firebase-token',
        true,
      );

      expect(result.data.canonicalUserId).toBe(phoneUserId);

      const googleIdentity = await prisma.userAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerUserId: {
            provider: 'supabase',
            providerUserId: 'asp-test-google-supabase',
          },
        },
      });
      expect(googleIdentity.userId).toBe(phoneUserId);

      const firebaseIdentity = await prisma.userAuthIdentity.findUniqueOrThrow({
        where: {
          provider_providerUserId: {
            provider: 'firebase',
            providerUserId: firebaseUid,
          },
        },
      });
      expect(firebaseIdentity.userId).toBe(phoneUserId);

      const afterWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId: phoneUserId },
      });
      expect(afterWallet.balance.toNumber()).toBe(
        beforeWallet.balance.toNumber(),
      );
      expect(afterWallet.paidBalance.toNumber()).toBe(
        beforeWallet.paidBalance.toNumber(),
      );
      expect(
        await prisma.subscription.count({
          where: { userId: phoneUserId, subscriptionStatus: 'ACTIVE' },
        }),
      ).toBe(1);
      expect(
        await prisma.kundliSavedRecord.count({
          where: { customerUserId: phoneUserId },
        }),
      ).toBe(1);

      const untouchedGoogleAccount = await prisma.user.findUniqueOrThrow({
        where: { id: googleUserId },
      });
      expect(untouchedGoogleAccount.subscriptionStatus).toBe('FREE');
    } finally {
      verifySpy.mockRestore();
      await prisma.userAuthIdentity.deleteMany({
        where: { provider: 'firebase', providerUserId: firebaseUid },
      });
      await resetGoogleFixture();
    }
  });

  it('does not duplicate a user or identity during simultaneous first phone logins', async () => {
    const phone = '+919888881111';
    const firebaseUid = 'asp-test-concurrent-first-phone-login';

    try {
      const results = await Promise.allSettled([
        service.syncFirebasePhoneUser({ firebaseUid, phone }),
        service.syncFirebasePhoneUser({ firebaseUid, phone }),
      ]);

      expect(results.some((result) => result.status === 'fulfilled')).toBe(
        true,
      );

      const users = await prisma.user.findMany({
        where: { phone },
        select: { id: true },
      });
      expect(users).toHaveLength(1);

      const identities = await prisma.userAuthIdentity.findMany({
        where: { provider: 'firebase', providerUserId: firebaseUid },
        select: { userId: true },
      });
      expect(identities).toHaveLength(1);
      expect(identities[0].userId).toBe(users[0].id);
    } finally {
      const user = await prisma.user.findUnique({
        where: { phone },
        select: { id: true },
      });

      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });
});
