const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function maskPhone(phone) {
  if (!phone) return '-';

  if (phone.length <= 5) return '***';

  return (
    phone.slice(0, 3) +
    '*'.repeat(Math.max(phone.length - 6, 3)) +
    phone.slice(-3)
  );
}

async function main() {

  console.log('\n==================================================');
  console.log(' LOCAL CUSTOMER HOROSCOPE PREVIEW');
  console.log('==================================================');

  const users = await prisma.user.findMany({
    where: {
      isAstrologer: false,
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 15,
    select: {
      id: true,
      phone: true,
      email: true,
      subscriptionStatus: true,
      subscriptionPlanId: true,
      updatedAt: true,
    },
  });

  if (!users.length) {
    throw new Error('No active customer users found.');
  }

  console.log('\nRECENT CUSTOMERS:\n');

  users.forEach((user, index) => {
    console.log(
      `[${index + 1}]`,
      maskPhone(user.phone),
      '|',
      user.email || '-',
      '| status:',
      user.subscriptionStatus,
      '| user:',
      user.id,
    );
  });

  const answer = await ask(
    '\nEnter customer number currently logged-in on Pixel 7: '
  );

  const index = Number(answer) - 1;

  if (
    Number.isNaN(index) ||
    index < 0 ||
    index >= users.length
  ) {
    throw new Error('Invalid customer selection.');
  }

  const user = users[index];

  console.log('\nSELECTED USER');
  console.log({
    id: user.id,
    phone: maskPhone(user.phone),
    email: user.email,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlanId: user.subscriptionPlanId,
  });


  // ----------------------------------------------------------
  // LOOK FOR A REAL ACTIVE DAILY-HOROSCOPE PLAN
  // ----------------------------------------------------------

  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        isFeatured: 'desc',
      },
      {
        price: 'asc',
      },
    ],
  });

  console.log('\nACTIVE SUBSCRIPTION PLANS:\n');

  plans.forEach((plan, i) => {
    console.log(
      `[${i + 1}]`,
      plan.displayName,
      '|',
      plan.name,
      '|',
      plan.currency,
      String(plan.price),
      '| duration:',
      plan.durationDays,
      '| features:',
      JSON.stringify(plan.features),
    );
  });

  if (!plans.length) {
    throw new Error(
      'No active SubscriptionPlan found. STOPPING without changing user.'
    );
  }


  // Prefer plan that explicitly contains horoscope capability.
  let horoscopePlan = plans.find(plan => {
    const value = JSON.stringify(plan.features || {}).toLowerCase();

    return (
      value.includes('horoscope') ||
      value.includes('dailyhoroscope') ||
      value.includes('daily_horoscope')
    );
  });

  if (!horoscopePlan) {
    console.log(
      '\nWARNING: No plan explicitly declares horoscope in features.'
    );

    const planAnswer = await ask(
      'Enter plan number used for Daily Horoscope (or 0 to STOP): '
    );

    const planIndex = Number(planAnswer) - 1;

    if (
      Number(planAnswer) === 0 ||
      Number.isNaN(planIndex) ||
      planIndex < 0 ||
      planIndex >= plans.length
    ) {
      console.log('\nSTOPPED. Database untouched.');
      return;
    }

    horoscopePlan = plans[planIndex];
  }

  console.log('\nHOROSCOPE PREVIEW PLAN:');
  console.log({
    id: horoscopePlan.id,
    name: horoscopePlan.name,
    displayName: horoscopePlan.displayName,
    durationDays: horoscopePlan.durationDays,
    features: horoscopePlan.features,
  });


  // ----------------------------------------------------------
  // SAVE CURRENT DATABASE STATE BEFORE PREVIEW
  // ----------------------------------------------------------

  const existingSubscriptions = await prisma.subscription.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const backup = {
    createdAt: new Date().toISOString(),

    user: {
      id: user.id,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlanId: user.subscriptionPlanId,
    },

    subscriptions: existingSubscriptions,
  };

  const backupPath = path.join(
    process.cwd(),
    `horoscope-preview-backup-${user.id}.json`
  );

  fs.writeFileSync(
    backupPath,
    JSON.stringify(backup, null, 2),
    'utf8',
  );

  console.log('\nBACKUP CREATED:');
  console.log(backupPath);


  // ----------------------------------------------------------
  // TEMPORARY LOCAL PREVIEW
  //
  // Important:
  // We are NOT fabricating Razorpay IDs.
  // This row only provides local entitlement for preview.
  // ----------------------------------------------------------

  const now = new Date();

  const endDate = new Date(
    now.getTime() +
    Math.max(horoscopePlan.durationDays || 30, 1)
      * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction(async tx => {

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlanId: horoscopePlan.id,
      },
    });


    const activeExisting =
      await tx.subscription.findFirst({
        where: {
          userId: user.id,
          subscriptionStatus: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (activeExisting) {

      await tx.subscription.update({
        where: {
          id: activeExisting.id,
        },
        data: {
          subscriptionPlanId: horoscopePlan.id,
          subscriptionStatus: 'ACTIVE',
          startDate: activeExisting.startDate || now,
          endDate,
          expiredAt: null,
          cancelledAt: null,
        },
      });

      console.log('\nUPDATED EXISTING ACTIVE SUBSCRIPTION:');
      console.log(activeExisting.id);

    } else {

      const created =
        await tx.subscription.create({
          data: {
            userId: user.id,
            subscriptionPlanId: horoscopePlan.id,
            subscriptionStatus: 'ACTIVE',
            amount: horoscopePlan.price,
            currency: horoscopePlan.currency,
            startDate: now,
            endDate,
            isTrial: true,
          },
        });

      console.log('\nCREATED LOCAL PREVIEW SUBSCRIPTION:');
      console.log(created.id);
    }
  });


  // ----------------------------------------------------------
  // VERIFY
  // ----------------------------------------------------------

  const verifyUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      subscriptionStatus: true,
      subscriptionPlanId: true,
    },
  });

  const verifySubscription =
    await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        subscriptionPlan: true,
      },
    });

  console.log('\n==================================================');
  console.log(' PREVIEW ACCESS RESULT');
  console.log('==================================================');

  console.dir(
    {
      user: verifyUser,
      activeSubscription: verifySubscription
        ? {
            id: verifySubscription.id,
            startDate: verifySubscription.startDate,
            endDate: verifySubscription.endDate,
            isTrial: verifySubscription.isTrial,
            plan: {
              id: verifySubscription.subscriptionPlan?.id,
              name: verifySubscription.subscriptionPlan?.name,
              displayName:
                verifySubscription.subscriptionPlan?.displayName,
              features:
                verifySubscription.subscriptionPlan?.features,
            },
          }
        : null,
    },
    {
      depth: null,
    },
  );

  console.log('\nLOCAL HOROSCOPE PREVIEW ENABLED.');
  console.log(
    'Production payment/Razorpay entitlement logic was NOT modified.'
  );
}

main()
  .catch(error => {
    console.error('\nPREVIEW FAILED');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
