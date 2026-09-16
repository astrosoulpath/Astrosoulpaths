const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const calls = await prisma.callSession.findMany({
    where: {
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log("PENDING COUNT:", calls.length);

  console.dir(
    calls.map((call) => ({
      id: call.id,
      customerUserId: call.userId,
      astrologerId: call.astrologerId,
      status: call.status,
      mode: call.mode,
      purchasedMinutes: call.purchasedMinutes,
      createdAt: call.createdAt,
      expiresAt: call.expiresAt,
    })),
    { depth: null, colors: true }
  );

  const rohan = await prisma.user.findFirst({
    where: {
      astrologer: {
        is: {
          isApproved: true,
          isVerified: true,
        },
      },
      OR: [
        { name: { equals: "Rohan", mode: "insensitive" } },
        { phone: "+918651542245" },
      ],
    },
    include: {
      astrologer: true,
    },
  });

  console.log("\nROHAN:");
  console.dir(
    rohan
      ? {
          userId: rohan.id,
          phone: rohan.phone,
          isAstrologer: rohan.isAstrologer,
          astrologerRowId: rohan.astrologer?.id,
          approved: rohan.astrologer?.isApproved,
          verified: rohan.astrologer?.isVerified,
          online: rohan.astrologer?.isOnline,
        }
      : null,
    { depth: null, colors: true }
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());