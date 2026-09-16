const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      role: true,
      userProfile: true,
      astrologer: true,
    },
  });

  const issues = [];

  for (const user of users) {
    const astro = user.astrologer;
    const role = user.role?.name ?? null;

    if (user.isAstrologer === true && !astro) {
      issues.push({
        type: "FLAG_TRUE_BUT_NO_ASTROLOGER_ROW",
        userId: user.id,
        phone: user.phone,
        name: user.userProfile?.fullName ?? user.name,
        role,
        isAstrologer: user.isAstrologer,
      });
    }

    if (astro?.isApproved === true && user.isAstrologer !== true) {
      issues.push({
        type: "APPROVED_BUT_ACCESS_DISABLED",
        userId: user.id,
        astrologerId: astro.id,
        phone: user.phone,
        name: user.userProfile?.fullName ?? user.name,
        role,
        isAstrologer: user.isAstrologer,
        isApproved: astro.isApproved,
        isVerified: astro.isVerified,
      });
    }

    if (
      astro?.isApproved === true &&
      astro?.isVerified === true &&
      role !== "ASTROLOGER"
    ) {
      issues.push({
        type: "APPROVED_BUT_WRONG_ROLE",
        userId: user.id,
        astrologerId: astro.id,
        phone: user.phone,
        name: user.userProfile?.fullName ?? user.name,
        role,
        isAstrologer: user.isAstrologer,
        isApproved: astro.isApproved,
        isVerified: astro.isVerified,
      });
    }

    if (
      astro &&
      astro.isApproved === false &&
      astro.isOnline === true
    ) {
      issues.push({
        type: "UNAPPROVED_BUT_ONLINE",
        userId: user.id,
        astrologerId: astro.id,
        phone: user.phone,
        name: user.userProfile?.fullName ?? user.name,
        role,
        isOnline: astro.isOnline,
      });
    }
  }

  console.log("TOTAL USERS:", users.length);
  console.log("TOTAL ISSUES:", issues.length);

  console.dir(issues, {
    depth: null,
    colors: true,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());