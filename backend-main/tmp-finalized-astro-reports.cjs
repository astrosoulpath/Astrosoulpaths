const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      id,
      "callSessionId",
      "customerUserId",
      "astrologerId",
      status,
      "finalizedAt",
      "createdAt",
      "updatedAt"
    FROM astrologer_kundli_reports
    ORDER BY "updatedAt" DESC
    LIMIT 20;
  `);

  console.table(rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
