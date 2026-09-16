const { PrismaClient, LedgerType, LedgerReferenceType } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const phone = "+918651540070";
  const amount = 2000;

  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      phone: true,
      name: true,
      isAstrologer: true,
    },
  });

  if (!user) {
    throw new Error(`Customer not found for ${phone}`);
  }

  if (user.isAstrologer === true) {
    throw new Error("STOP: selected account is astrologer, not customer");
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        currency: "INR",
      },
    });

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore.plus(amount);

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
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

    return { updatedWallet, ledger };
  });

  console.log({
    customer: user,
    balance: Number(result.updatedWallet.balance),
    lockedBalance: Number(result.updatedWallet.lockedBalance),
    recharge: Number(result.ledger.amount),
    ledgerType: result.ledger.type,
    referenceId: result.ledger.referenceId,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
