const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.subscriptionPlan.findUnique({
    where: {
      name: "ASTROLOGER_KUNDLI_YEARLY",
    },
  });

  if (!existing) {
    throw new Error("ASTROLOGER_KUNDLI_YEARLY plan not found.");
  }

  const oldFeatures =
    existing.features &&
    typeof existing.features === "object" &&
    !Array.isArray(existing.features)
      ? existing.features
      : {};

  const updated = await prisma.subscriptionPlan.update({
    where: {
      id: existing.id,
    },
    data: {
      displayName: "Kundli Professional",
      price: 3500,
      currency: "INR",
      durationDays: 365,
      isActive: true,
      features: {
        ...oldFeatures,
        portal: "astrologer",
        yearlyAccess: true,
        unlimitedKundli: true,
        professionalPdfReports: true,
        savedCustomerCharts: true,
        printReports: true,
      },
    },
  });

  console.log("\nUPDATED PLAN:");
  console.dir(updated, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
