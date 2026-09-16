const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: {
      name: "ASTROLOGER_KUNDLI_YEARLY",
    },
  });

  console.log("\nCURRENT PLAN:");
  console.dir(plan, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
