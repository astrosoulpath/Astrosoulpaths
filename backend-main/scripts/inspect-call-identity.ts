import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect(label: string, authenticatedId: string) {
  console.log(`\n================ ${label} ================`);
  console.log('AUTHENTICATED_ID:', authenticatedId);

  const byId = await prisma.user.findUnique({
    where: { id: authenticatedId },
    select: {
      id: true,
      supabaseId: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      isBlocked: true,
    },
  });

  const bySupabase = await prisma.user.findUnique({
    where: { supabaseId: authenticatedId },
    select: {
      id: true,
      supabaseId: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      isBlocked: true,
    },
  });

  const identities = await prisma.userAuthIdentity.findMany({
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
          role: true,
          isActive: true,
          isBlocked: true,
        },
      },
    },
  });

  console.log('USER_BY_INTERNAL_ID:');
  console.dir(byId, { depth: null });

  console.log('USER_BY_SUPABASE_ID:');
  console.dir(bySupabase, { depth: null });

  console.log('AUTH_IDENTITIES:');
  console.dir(identities, { depth: null });
}

async function main() {
  await inspect(
    'CUSTOMER',
    'b1b765c3-55d3-4f6d-999a-e0cb8e507356',
  );

  await inspect(
    'ASTROLOGER',
    'cf076e74-8554-4b5d-bf37-f756f0e6ef96',
  );

  console.log('\n================ CUSTOMER USERS ================');

  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
    },
    select: {
      id: true,
      supabaseId: true,
      phone: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isBlocked: true,
      authIdentities: {
        select: {
          provider: true,
          providerUserId: true,
          identityType: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  console.dir(customers, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
