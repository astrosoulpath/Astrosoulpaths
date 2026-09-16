const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = q => new Promise(resolve => rl.question(q, resolve));

function normalizePhone(v) {
  return String(v || '').replace(/[^\d+]/g, '');
}

async function main() {

  console.log('\n==================================================');
  console.log(' HOROSCOPE EXACT CUSTOMER PREVIEW');
  console.log('==================================================');

  const input = (await ask(
    '\nEnter logged-in customer PHONE or EMAIL: '
  )).trim();

  if (!input) {
    throw new Error('Phone/email cannot be empty.');
  }

  let user = null;

  if (input.includes('@')) {

    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: input,
          mode: 'insensitive',
        },
      },
    });

  } else {

    const phone = normalizePhone(input);

    const allCustomers = await prisma.user.findMany({
      where: {
        isAstrologer: false,
      },
    });

    user = allCustomers.find(u =>
      normalizePhone(u.phone) === phone
    );

    // Common Indian formatting fallback
    if (!user && phone.startsWith('+91')) {
      const local = phone.substring(3);

      user = allCustomers.find(u => {
        const p = normalizePhone(u.phone);

        return (
          p === local ||
          p === `91${local}` ||
          p === `+91${local}`
        );
      });
    }
  }

  if (!user) {

    console.log('\nCUSTOMER NOT FOUND BY PHONE/EMAIL.');
    console.log('\nExisting CUSTOMER users:\n');

    const customers = await prisma.user.findMany({
      where: {
        isAstrologer: false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        phone: true,
        email: true,
        supabaseId: true,
        subscriptionStatus: true,
        isActive: true,
        updatedAt: true,
      },
    });

    console.table(customers);

    console.log('\nNO DATABASE CHANGE PERFORMED.');
    return;
  }

  console.log('\nFOUND CUSTOMER');
  console.dir({
    id: user.id,
    phone: user.phone,
    email: user.email,
    supabaseId: user.supabaseId,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlanId: user.subscriptionPlanId,
  }, { depth: null });


  // ---------------------------------------------------------
  // FIND ACTIVE HOROSCOPE PLAN
  // ---------------------------------------------------------

  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { isFeatured: 'desc' },
      { price: 'asc' },
    ],
  });

  if (!plans.length) {
    throw new Error(
      'No ACTIVE subscription plan exists. Nothing changed.'
    );
  }

  console.log('\nACTIVE PLANS:\n');

  plans.forEach((plan, i) => {
    console.log(
      `[${i + 1}]`,
      plan.displayName,
      '| name:',
      plan.name,
      '| price:',
      String(plan.price),
      plan.currency,
      '| days:',
      plan.durationDays,
      '| features:',
      JSON.stringify(plan.features)
    );
  });


  let plan = plans.find(p => {
    const s =
      `${p.name} ${p.displayName} ${JSON.stringify(p.features || {})}`
        .toLowerCase();

    return s.includes('horoscope');
  });

  if (!plan) {

    const answer = await ask(
      '\nEnter plan NUMBER for Daily Horoscope (0 = stop): '
    );

    if (Number(answer) === 0) {
      console.log('\nSTOPPED. Database untouched.');
      return;
    }

    const index = Number(answer) - 1;

    if (
      Number.isNaN(index) ||
      index < 0 ||
      index >= plans.length
    ) {
      throw new Error('Invalid plan number.');
    }

    plan = plans[index];
  }


  console.log('\nSELECTED HOROSCOPE PLAN');
  console.dir({
    id: plan.id,
    name: plan.name,
    displayName: plan.displayName,
    price: String(plan.price),
    currency: plan.currency,
    durationDays: plan.durationDays,
    features: plan.features,
  }, { depth: null });


  // ---------------------------------------------------------
  // SNAPSHOT BEFORE CHANGE
  // ---------------------------------------------------------

  const beforeSubscriptions =
    await prisma.subscription.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  const fs = require('fs');

  const backupPath =
    `horoscope-preview-${user.id}-${Date.now()}.json`;

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        user: {
          id: user.id,
          subscriptionStatus: user.subscriptionStatus,
          subscriptionPlanId: user.subscriptionPlanId,
        },
        subscriptions: beforeSubscriptions,
      },
      null,
      2,
    ),
  );

  console.log('\nBACKUP:', backupPath);


  // ---------------------------------------------------------
  // LOCAL PREVIEW ENTITLEMENT
  // ---------------------------------------------------------

  const startDate = new Date();

  const endDate = new Date(
    startDate.getTime() +
    Math.max(Number(plan.durationDays || 30), 1) *
      86400000
  );

  await prisma.$transaction(async tx => {

    // Disable any stale local ACTIVE preview rows first.
    await tx.subscription.updateMany({
      where: {
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
      },
      data: {
        subscriptionStatus: 'EXPIRED',
        expiredAt: startDate,
      },
    });


    const preview =
      await tx.subscription.create({
        data: {
          userId: user.id,
          subscriptionPlanId: plan.id,
          subscriptionStatus: 'ACTIVE',
          amount: plan.price,
          currency: plan.currency,
          startDate,
          endDate,
          isTrial: true,
        },
      });


    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlanId: plan.id,
      },
    });


    console.log('\nCREATED LOCAL PREVIEW');
    console.dir({
      subscriptionId: preview.id,
      status: preview.subscriptionStatus,
      startDate: preview.startDate,
      endDate: preview.endDate,
    });
  });


  // ---------------------------------------------------------
  // FINAL VERIFY
  // ---------------------------------------------------------

  const verify = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      phone: true,
      email: true,
      subscriptionStatus: true,
      subscriptionPlanId: true,

      subscriptions: {
        where: {
          subscriptionStatus: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          subscriptionPlan: true,
        },
      },
    },
  });


  console.log('\n==================================================');
  console.log(' HOROSCOPE PREVIEW VERIFY');
  console.log('==================================================');

  console.dir(verify, {
    depth: null,
  });


  console.log('\nSUCCESS');
  console.log(
    'Real Flutter/backend entitlement path can now be tested.'
  );
}

main()
  .catch(err => {
    console.error('\nFAILED');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
