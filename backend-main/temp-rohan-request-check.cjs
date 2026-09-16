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
    take: 5,
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

  console.log("ROHAN USER ID:", rohanUserId);
  console.log("ROHAN CALL COUNT:", calls.length);

  console.dir(calls, {
    depth: null,
    colors: true,
  });

  const now = new Date();

  console.log(
    "ACTIVE/PENDING NOW:",
    calls.filter(
      (call) =>
        !call.endedAt &&
        call.expiresAt > now &&
        ["PENDING", "ACTIVE"].includes(call.status.toUpperCase()),
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());