const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.subscription.findMany({
    where: {
      subscriptionPlan: {
        name: "ASTROLOGER_KUNDLI_YEARLY",
      },
    },
    include: {
      subscriptionPlan: true,
      user: {
        select: {
          id: true,
          phone: true,
          email: true,
          role: true,
          isAstrologer: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  console.log("\nASTROLOGER KUNDLI SUBSCRIPTIONS");
  console.table(rows.map((row) => ({
    subscriptionId: row.id,
    phone: row.user?.phone ?? null,
    role: row.user?.role ?? null,
    status: row.subscriptionStatus,
    startDate: row.startDate,
    endDate: row.endDate,
    plan: row.subscriptionPlan?.name,
    price: row.subscriptionPlan?.price?.toString(),
  })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
