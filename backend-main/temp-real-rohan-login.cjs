const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      id: "5b1b3043-3f6d-498b-8975-90675e144317",
    },
    include: {
      role: true,
      userProfile: true,
      astrologer: {
        include: {
          expertise: {
            include: {
              expertise: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.log("REAL ROHAN USER NOT FOUND");
    return;
  }

  console.log("======================================");
  console.log("NAME:", user.name);
  console.log("PROFILE NAME:", user.userProfile?.fullName);
  console.log("LOGIN PHONE:", user.phone);
  console.log("SUPABASE ID:", user.supabaseId);
  console.log("ROLE:", user.role?.name);
  console.log("IS ASTROLOGER:", user.isAstrologer);
  console.log("ACTIVE:", user.isActive);
  console.log("BLOCKED:", user.isBlocked);

  console.log("ASTROLOGER ID:", user.astrologer?.id);
  console.log("APPROVED:", user.astrologer?.isApproved);
  console.log("VERIFIED:", user.astrologer?.isVerified);
  console.log("ONLINE:", user.astrologer?.isOnline);
  console.log("PRICE:", user.astrologer?.pricePerMin);
  console.log("EXPERIENCE:", user.astrologer?.experience);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());