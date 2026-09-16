const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rohanUserId = "5b1b3043-3f6d-498b-8975-90675e144317";

  const calls = await prisma.callSession.findMany({
    where: {
      astrologerId: rohanUserId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      userId: true,
      astrologerId: true,
      status: true,
      mode: true,
      purchasedMinutes: true,
      ratePerMinute: true,
      amountCharged: true,
      isFreeChat: true,
      createdAt: true,
      startedAt: true,
      expiresAt: true,
      endedAt: true,
    },
  });

  console.log("SERVER NOW:", new Date().toISOString());
  console.log("ROHAN USER:", rohanUserId);

  console.table(
    calls.map((call) => ({
      id: call.id,
      customer: call.userId,
      status: call.status,
      minutes: call.purchasedMinutes,
      createdAt: call.createdAt?.toISOString(),
      expiresAt: call.expiresAt?.toISOString(),
      endedAt: call.endedAt?.toISOString() ?? null,
    })),
  );

  if (calls[0]) {
    console.log("\nLATEST CALL:");
    console.dir(calls[0], { depth: null, colors: true });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());