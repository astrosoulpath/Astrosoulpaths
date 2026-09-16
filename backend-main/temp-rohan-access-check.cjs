const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const astrologers = await prisma.astrologer.findMany({
    include: {
      user: {
        include: {
          userProfile: true,
          role: true,
        },
      },
    },
  });

  console.log("TOTAL ASTROLOGERS:", astrologers.length);

  for (const astro of astrologers) {
    const name =
      astro.user?.userProfile?.fullName ??
      astro.user?.userProfile?.username ??
      '';

    if (name.toLowerCase().includes("rohan")) {
      console.log("======================================");
      console.log("NAME:", name);
      console.log("LOGIN PHONE:", astro.user?.phone);
      console.log("USER ID:", astro.userId);
      console.log("ASTROLOGER ID:", astro.id);
      console.log("ROLE:", astro.user?.role?.name);
      console.log("ACTIVE:", astro.user?.isActive);
      console.log("BLOCKED:", astro.user?.isBlocked);
      console.log("ASTRO RAW:", astro);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());