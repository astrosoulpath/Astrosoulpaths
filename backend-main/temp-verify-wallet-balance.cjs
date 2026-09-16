const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      id: "f03ed02d-5de0-42f1-8315-387fbfbf971d",
    },
    include: {
      wallet: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  console.log("PHONE:", user.phone);
  console.log("BALANCE:", user.wallet ? Number(user.wallet.balance) : null);
  console.log(
    "LOCKED:",
    user.wallet ? Number(user.wallet.lockedBalance) : null
  );
  console.log(
    "AVAILABLE:",
    user.wallet
      ? Number(user.wallet.balance) - Number(user.wallet.lockedBalance)
      : null
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
