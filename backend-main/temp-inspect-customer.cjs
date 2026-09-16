const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const phone = "+918651540070";

  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      role: true,
      wallet: true,
      astrologer: true,
    },
  });

  console.dir(user, {
    depth: 5,
    colors: true,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
