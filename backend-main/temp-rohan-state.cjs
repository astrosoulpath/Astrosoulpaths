const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      phone: "+919999999999",
    },
    include: {
      role: true,
      userProfile: true,
      astrologer: true,
    },
  });

  if (!user) {
    console.log("ROHAN USER NOT FOUND");
    return;
  }

  console.dir({
    userId: user.id,
    phone: user.phone,
    role: user.role?.name,
    isAstrologer: user.isAstrologer,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    profileName: user.userProfile?.fullName,
    astrologer: user.astrologer,
  }, { depth: null, colors: true });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());