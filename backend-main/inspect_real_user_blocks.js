require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.userBlock.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
    select: {
      id: true,
      blockerId: true,
      blockedUserId: true,
      isActive: true,
      blockedAt: true,
      unblockedAt: true,
      createdAt: true,
    },
  });

  console.log('TOTAL BLOCK ROWS:', rows.length);

  for (const row of rows) {
    console.log('--------------------------------');
    console.log(row);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
