import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOMER_SUB =
  'b1b765c3-55d3-4f6d-999a-e0cb8e507356';

const ASTRO_SUB =
  'cf076e74-8554-4b5d-bf37-f756f0e6ef96';

async function inspectIdentity(
  label: string,
  authenticatedId: string,
) {
  console.log(
    `\n================ ${label} ================`,
  );

  console.log(
    'AUTHENTICATED_ID:',
    authenticatedId,
  );

  const byInternalId =
    await prisma.user.findUnique({
      where: {
        id: authenticatedId,
      },
      select: {
        id: true,
        supabaseId: true,
        phone: true,
        email: true,
        name: true,
        isActive: true,
        isBlocked: true,
        role: true,
      },
    });

  const bySupabaseId =
    await prisma.user.findUnique({
      where: {
        supabaseId: authenticatedId,
      },
      select: {
        id: true,
        supabaseId: true,
        phone: true,
        email: true,
        name: true,
        isActive: true,
        isBlocked: true,
        role: true,
      },
    });

  const linkedIdentities =
    await prisma.userAuthIdentity.findMany({
      where: {
        providerUserId: authenticatedId,
      },
      select: {
        id: true,
        userId: true,
        provider: true,
        providerUserId: true,
        identityType: true,
        user: {
          select: {
            id: true,
            supabaseId: true,
            phone: true,
            email: true,
            name: true,
            isActive: true,
            isBlocked: true,
            role: true,
          },
        },
      },
    });

  console.log('\nUSER_BY_INTERNAL_ID');
  console.dir(
    byInternalId,
    { depth: null },
  );

  console.log('\nUSER_BY_SUPABASE_ID');
  console.dir(
    bySupabaseId,
    { depth: null },
  );

  console.log('\nUSER_AUTH_IDENTITIES');
  console.dir(
    linkedIdentities,
    { depth: null },
  );
}

async function main() {
  await inspectIdentity(
    'CUSTOMER',
    CUSTOMER_SUB,
  );

  await inspectIdentity(
    'ASTROLOGER',
    ASTRO_SUB,
  );

  console.log(
    '\n================ RECENT USERS ================',
  );

  /*
   * No role filter here.
   * In this schema role is a relation, not a scalar enum/string.
   */
  const recentUsers =
    await prisma.user.findMany({
      select: {
        id: true,
        supabaseId: true,
        phone: true,
        email: true,
        name: true,
        isActive: true,
        isBlocked: true,
        createdAt: true,
        role: true,
        authIdentities: {
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            identityType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

  console.dir(
    recentUsers,
    { depth: null },
  );

  console.log(
    '\n================ DUPLICATE PHONE CHECK ================',
  );

  const usersWithPhone =
    recentUsers.filter(
      (user) =>
        typeof user.phone === 'string' &&
        user.phone.trim().length > 0,
    );

  const byPhone =
    new Map<string, typeof usersWithPhone>();

  for (const user of usersWithPhone) {
    const key =
      user.phone!
        .replace(/[^\d+]/g, '')
        .trim();

    const existing =
      byPhone.get(key) ?? [];

    existing.push(user);

    byPhone.set(
      key,
      existing,
    );
  }

  for (const [phone, users] of byPhone.entries()) {
    if (users.length > 1) {
      console.log(
        `\nDUPLICATE_PHONE=${phone}`,
      );

      console.dir(
        users,
        { depth: null },
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
