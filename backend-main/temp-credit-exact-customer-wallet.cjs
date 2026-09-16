const {
  PrismaClient,
  LedgerType,
  LedgerReferenceType,
} = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const expectedUserId = "f03ed02d-5de0-42f1-8315-387fbfbf971d";
  const expectedPhone = "+918651540070";
  const amount = 2000;

  const user = await prisma.user.findUnique({
    where: {
      id: expectedUserId,
    },
    include: {
      wallet: true,
    },
  });

  if (!user) {
    throw new Error("STOP: exact user not found");
  }

  if (user.phone !== expectedPhone) {
    throw new Error(
      `STOP: phone mismatch. Expected ${expectedPhone}, found ${user.phone}`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: {
        userId: user.id,
      },
      update: {},
      create: {
        userId: user.id,
        currency: "INR",
      },
    });

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.plus(amount);

    const updatedWallet = await tx.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: balanceAfter,
      },
    });

    const ledger = await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        userId: user.id,
        type: LedgerType.RECHARGE,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: LedgerReferenceType.WALLET_RECHARGE,
        referenceId: `LOCAL-TEST-${Date.now()}`,
        description: "Local development wallet recharge",
      },
    });

    return {
      updatedWallet,
      ledger,
      balanceBefore,
    };
  });

  console.log("\n========== WALLET RECHARGE SUCCESS ==========");
  console.log("USER ID:", user.id);
  console.log("PHONE:", user.phone);
  console.log("BALANCE BEFORE:", Number(result.balanceBefore));
  console.log("RECHARGE:", Number(result.ledger.amount));
  console.log("BALANCE AFTER:", Number(result.updatedWallet.balance));
  console.log("LOCKED:", Number(result.updatedWallet.lockedBalance));
  console.log("AVAILABLE:",
    Number(result.updatedWallet.balance) -
    Number(result.updatedWallet.lockedBalance)
  );
  console.log("LEDGER TYPE:", result.ledger.type);
  console.log("REFERENCE:", result.ledger.referenceId);
  console.log("=============================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
