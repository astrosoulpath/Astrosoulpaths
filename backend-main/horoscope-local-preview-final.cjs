require('dotenv').config();

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {

  console.log('\n==================================================');
  console.log(' LOCAL DAILY HOROSCOPE PREVIEW');
  console.log('==================================================');

  // --------------------------------------------------------
  // SAFETY: NEVER RUN THIS AGAINST PRODUCTION DATABASE
  // --------------------------------------------------------

  const dbUrl = String(process.env.DATABASE_URL || '').toLowerCase();

  const isLocal =
    dbUrl.includes('localhost') ||
    dbUrl.includes('127.0.0.1');

  if (!isLocal) {
    throw new Error(
      'STOPPED: DATABASE_URL does not look local. ' +
      'Preview entitlement will NOT run against production.'
    );
  }

  console.log('LOCAL DATABASE CONFIRMED.');

  const phone = '+918651540070';

  // --------------------------------------------------------
  // EXACT IDENTITY
  // --------------------------------------------------------

  const users = await prisma.user.findMany({
    where: { phone },
    include: {
      role: true,
    },
  });

  if (users.length !== 1) {
    throw new Error(
      `Expected exactly 1 user for ${phone}, found ${users.length}.`
    );
  }

  const user = users[0];

  console.log('\n=== EXACT USER ===');

  console.dir({
    id: user.id,
    phone: user.phone,
    role: user.role?.name ?? null,
    isActive: user.isActive,
    isAstrologer: user.isAstrologer,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionPlanId: user.subscriptionPlanId,
  }, { depth: null });


  // --------------------------------------------------------
  // ACTIVE PLANS
  // --------------------------------------------------------

  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      { isFeatured: 'desc' },
      { price: 'asc' },
    ],
  });

  console.log('\n=== ACTIVE SUBSCRIPTION PLANS ===');

  plans.forEach((p, index) => {
    console.log(
      `[${index + 1}]`,
      p.displayName,
      '| name:', p.name,
      '| price:', String(p.price), p.currency,
      '| days:', p.durationDays,
      '| features:', JSON.stringify(p.features)
    );
  });

  // --------------------------------------------------------
  // FIRST PREFERENCE:
  // user's already-linked plan
  // --------------------------------------------------------

  let selectedPlan = null;

  if (user.subscriptionPlanId) {

    const linkedPlan = plans.find(
      p => p.id === user.subscriptionPlanId
    );

    if (linkedPlan) {

      const text = (
        `${linkedPlan.name} ` +
        `${linkedPlan.displayName} ` +
        `${JSON.stringify(linkedPlan.features || {})}`
      ).toLowerCase();

      if (text.includes('horoscope')) {
        selectedPlan = linkedPlan;
      }
    }
  }

  // --------------------------------------------------------
  // SECOND PREFERENCE:
  // find explicitly horoscope-enabled plan
  // --------------------------------------------------------

  if (!selectedPlan) {

    selectedPlan = plans.find(p => {

      const text = (
        `${p.name} ` +
        `${p.displayName} ` +
        `${JSON.stringify(p.features || {})}`
      ).toLowerCase();

      return (
        text.includes('daily horoscope') ||
        text.includes('daily_horoscope') ||
        text.includes('dailyhoroscope') ||
        text.includes('horoscope')
      );
    });
  }


  if (!selectedPlan) {

    console.log('\n==================================================');
    console.log(' NO HOROSCOPE PLAN AUTO-DETECTED');
    console.log('==================================================');

    console.log(
      'Nothing was changed. Send the ACTIVE PLAN list to ChatGPT.'
    );

    return;
  }


  console.log('\n=== SELECTED HOROSCOPE PLAN ===');

  console.dir({
    id: selectedPlan.id,
    name: selectedPlan.name,
    displayName: selectedPlan.displayName,
    price: String(selectedPlan.price),
    currency: selectedPlan.currency,
    durationDays: selectedPlan.durationDays,
    features: selectedPlan.features,
  }, { depth: null });


  // --------------------------------------------------------
  // BACKUP CURRENT STATE
  // --------------------------------------------------------

  const existingSubscriptions =
    await prisma.subscription.findMany({
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
      phone: user.phone,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlanId: user.subscriptionPlanId,
    },

    subscriptions: existingSubscriptions,
  };

  const backupPath =
    `horoscope-preview-backup-${Date.now()}.json`;

  fs.writeFileSync(
    backupPath,
    JSON.stringify(backup, null, 2),
    'utf8'
  );

  console.log('\nBACKUP CREATED:');
  console.log(backupPath);


  const now = new Date();

  const durationDays =
    Math.max(Number(selectedPlan.durationDays || 30), 1);

  const endDate =
    new Date(now.getTime() + durationDays * 86400000);


  // --------------------------------------------------------
  // LOCAL PREVIEW
  // --------------------------------------------------------

  await prisma.$transaction(async tx => {

    // Existing active local subscriptions are expired first
    // so entitlement resolution is unambiguous.
    await tx.subscription.updateMany({
      where: {
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
      },
      data: {
        subscriptionStatus: 'EXPIRED',
        expiredAt: now,
      },
    });


    await tx.subscription.create({
      data: {
        userId: user.id,
        subscriptionPlanId: selectedPlan.id,

        subscriptionStatus: 'ACTIVE',

        amount: selectedPlan.price,
        currency: selectedPlan.currency,

        startDate: now,
        endDate,

        // Local preview marker only.
        isTrial: true,

        // IMPORTANT:
        // No fake Razorpay IDs are created.
      },
    });


    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionPlanId: selectedPlan.id,
      },
    });

  });


  // --------------------------------------------------------
  // VERIFY
  // --------------------------------------------------------

  const verified = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      phone: true,

      role: {
        select: {
          name: true,
        },
      },

      isAstrologer: true,

      subscriptionStatus: true,
      subscriptionPlanId: true,

      subscriptions: {
        where: {
          subscriptionStatus: 'ACTIVE',
        },
        include: {
          subscriptionPlan: true,
        },
      },
    },
  });


  console.log('\n==================================================');
  console.log(' HOROSCOPE LOCAL PREVIEW ENABLED');
  console.log('==================================================');

  console.dir(verified, {
    depth: null,
  });

  console.log('\nEXPECTED: subscriptionStatus = ACTIVE');
  console.log('Role/admin/astrologer identity was NOT changed.');
  console.log('No Razorpay/payment record was fabricated.');
}


main()
  .catch(error => {

    console.error('\nFAILED');
    console.error(error);

    process.exitCode = 1;

  })
  .finally(async () => {

    await prisma.$disconnect();

  });
