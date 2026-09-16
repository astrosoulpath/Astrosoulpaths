const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {

  const users = await prisma.user.findMany({
    orderBy: {
      updatedAt: 'desc',
    },
    take: 20,
    select: {
      id: true,
      phone: true,
      email: true,
      supabaseId: true,
      isActive: true,
      isAstrologer: true,
      subscriptionStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.table(users);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
