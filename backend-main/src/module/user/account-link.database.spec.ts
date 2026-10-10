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
    const databaseUrl = process.env.DATABASE_URL ?? '';
    const directUrl = process.env.DIRECT_URL ?? '';

    const isSafeUrl = (value: string) => {
      try {
        const url = new URL(value);

        return (
          url.hostname === '127.0.0.1' &&
          url.port === '55432' &&
          url.pathname === '/asp_account_link_test'
        );
      } catch {
        return false;
      }
    };

    if (!isSafeUrl(databaseUrl) || (directUrl && !isSafeUrl(directUrl))) {
      throw new Error('Unsafe database URL. Integration test blocked.');
    }

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

    service = new UserService(prisma as any, {} as any);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
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
    const user = await service.resolveUserBySupabaseId(
      'asp-test-google-supabase',
    );

    expect(user?.id).toBe('asp-test-google-user');
  });

  it('resolves phone login to original account', async () => {
    const user = await service.resolveUserBySupabaseId(
      'asp-test-phone-supabase',
    );

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
});
