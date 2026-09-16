const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: {
      name: "ASTROLOGER_KUNDLI_YEARLY",
    },
  });

  if (!plan) {
    throw new Error("Plan disappeared after update.");
  }

  console.table([
    {
      name: plan.name,
      displayName: plan.displayName,
      price: String(plan.price),
      currency: plan.currency,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
    },
  ]);

  if (Number(plan.price) !== 3500) {
    throw new Error(`Price mismatch: ${plan.price}`);
  }

  if (plan.currency !== "INR") {
    throw new Error(`Currency mismatch: ${plan.currency}`);
  }

  if (plan.durationDays !== 365) {
    throw new Error(`Duration mismatch: ${plan.durationDays}`);
  }

  if (!plan.isActive) {
    throw new Error("Plan is not active.");
  }

  console.log("\nKUNDLI YEARLY PLAN DB GATE = PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
