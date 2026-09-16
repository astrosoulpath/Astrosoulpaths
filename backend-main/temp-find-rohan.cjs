const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const profiles = await prisma.userProfile.findMany({
    where: {
      fullName: {
        contains: "Rohan",
        mode: "insensitive",
      },
    },
    include: {
      user: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!profiles.length) {
    console.log("NO ROHAN PROFILE FOUND");
    return;
  }

  for (const profile of profiles) {
    console.log("================================");
    console.log("PROFILE NAME:", profile.fullName);
    console.log("PROFILE PHONE:", profile.phoneNumber);
    console.log("PROFILE USER ID:", profile.userId);
    console.log("USER PHONE:", profile.user?.phone);
    console.log("USER EMAIL:", profile.user?.email);
    console.log("USER ROLE:", profile.user?.role?.name);
    console.log("SUPABASE ID:", profile.user?.supabaseId);
    console.log("ACTIVE:", profile.user?.isActive);
    console.log("BLOCKED:", profile.user?.isBlocked);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });