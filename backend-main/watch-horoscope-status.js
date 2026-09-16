const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const userId = 'b5daa437-f714-4033-88d0-c3cd462b3ce5';

async function check() {
  const latest = await prisma.subscription.findFirst({
    where: {
      userId,
      subscriptionPlan: {
        name: 'DAILY_HOROSCOPE_MONTHLY',
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      subscriptionPlan: true,
    },
  });

  console.clear();

  console.log('==============================================');
  console.log(' DAILY HOROSCOPE SUBSCRIPTION LIVE STATUS');
  console.log('==============================================');

  console.dir({
    id: latest?.id,
    status: latest?.subscriptionStatus,
    plan: latest?.subscriptionPlan?.name,
    razorpayOrderId: latest?.razorpayOrderId,
    razorpayPaymentId: latest?.razorpayPaymentId,
    startDate: latest?.startDate,
    endDate: latest?.endDate,
    createdAt: latest?.createdAt,
    updatedAt: latest?.updatedAt,
  }, { depth: null });

  console.log('');
  console.log('Waiting for fresh payment...');
  console.log('Ctrl+C to stop.');
}

(async () => {
  try {
    await check();

    setInterval(async () => {
      try {
        await check();
      } catch (e) {
        console.error(e);
      }
    }, 5000);

  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
