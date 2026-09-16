require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function normalizePhone(value) {
  return String(value || '')
    .trim()
    .replace(/[^\d+]/g, '');
}

async function main() {

  console.log('\n==================================================');
  console.log(' EXACT PHONE -> SUPABASE -> LOCAL USER MAPPING');
  console.log('==================================================');

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not found in backend .env');
  }

  if (!serviceKey) {
    throw new Error(
      'Supabase service-role key not found. ' +
      'Expected SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY.'
    );
  }

  let createClient;

  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    throw new Error(
      '@supabase/supabase-js package not found in backend.'
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const inputPhone = normalizePhone(
    await ask('\nEnter logged-in phone (+91...): ')
  );

  if (!inputPhone) {
    throw new Error('Phone cannot be empty.');
  }

  console.log('\nSearching Supabase Auth users...');

  let matchedAuthUser = null;
  let page = 1;

  while (!matchedAuthUser && page <= 100) {

    const {
      data,
      error,
    } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];

    matchedAuthUser = users.find((u) => {
      return normalizePhone(u.phone) === inputPhone;
    });

    if (users.length < 1000) {
      break;
    }

    page++;
  }

  if (!matchedAuthUser) {

    console.log('\nPHONE NOT FOUND IN SUPABASE AUTH.');
    console.log('No database change performed.');

    return;
  }

  console.log('\nSUPABASE AUTH USER FOUND');

  console.dir(
    {
      id: matchedAuthUser.id,
      phone: matchedAuthUser.phone,
      email: matchedAuthUser.email || null,
      created_at: matchedAuthUser.created_at,
      last_sign_in_at: matchedAuthUser.last_sign_in_at,
    },
    { depth: null }
  );


  // ---------------------------------------------------------
  // MATCH SAME SUPABASE USER IN LOCAL DATABASE
  // ---------------------------------------------------------

  let localUser = await prisma.user.findFirst({
    where: {
      supabaseId: matchedAuthUser.id,
    },
  });

  if (!localUser && matchedAuthUser.email) {

    localUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: matchedAuthUser.email,
          mode: 'insensitive',
        },
      },
    });
  }

  if (!localUser) {

    console.log('\nSUPABASE USER EXISTS, BUT LOCAL USER MAPPING MISSING.');

    console.dir({
      supabaseId: matchedAuthUser.id,
      phone: matchedAuthUser.phone,
      email: matchedAuthUser.email || null,
    });

    console.log('\nNO DATABASE CHANGE PERFORMED.');
    console.log(
      'This confirms an auth-user synchronization bug.'
    );

    return;
  }


  console.log('\nLOCAL USER FOUND');

  console.dir({
    id: localUser.id,
    supabaseId: localUser.supabaseId,
    phone: localUser.phone,
    email: localUser.email,
    subscriptionStatus: localUser.subscriptionStatus,
    subscriptionPlanId: localUser.subscriptionPlanId,
    isActive: localUser.isActive,
    isAstrologer: localUser.isAstrologer,
  });


  // ---------------------------------------------------------
  // IMPORTANT IDENTITY SAFETY CHECK
  // ---------------------------------------------------------

  if (
    localUser.supabaseId &&
    localUser.supabaseId !== matchedAuthUser.id
  ) {
    throw new Error(
      'Supabase identity mismatch. STOPPED for safety.'
    );
  }


  // ---------------------------------------------------------
  // FIX THE MISSING PHONE SYNC
  // Only if same Supabase identity is proven.
  // ---------------------------------------------------------

  if (!localUser.phone) {

    console.log('\nLOCAL PHONE IS NULL.');
    console.log(
      'Exact Supabase identity is proven, so phone can be synchronized safely.'
    );

    const confirmSync = (
      await ask(
        `Sync ${matchedAuthUser.phone} into this local User? (Y/N): `
      )
    ).trim().toUpperCase();

    if (confirmSync === 'Y') {

      localUser = await prisma.user.update({
        where: {
          id: localUser.id,
        },
        data: {
          phone: matchedAuthUser.phone,
        },
      });

      console.log('\nPHONE SYNC COMPLETE.');

    } else {

      console.log('\nPhone sync skipped.');
    }
  }


  // ---------------------------------------------------------
  // FIND HOROSCOPE SUBSCRIPTION PLAN
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
    throw new Error('No active subscription plans found.');
  }

  console.log('\nACTIVE SUBSCRIPTION PLANS:\n');

  plans.forEach((plan, index) => {

    console.log(
      `[${index + 1}]`,
      plan.displayName,
      '| name:',
      plan.name,
      '| price:',
      String(plan.price),
      plan.currency,
      '| days:',
      plan.durationDays,
      '| features:',
      JSON.stringify(plan.features),
    );
  });


  let horoscopePlan = plans.find((plan) => {

    const text = (
      plan.name +
      ' ' +
      plan.displayName +
      ' ' +
      JSON.stringify(plan.features || {})
    ).toLowerCase();

    return text.includes('horoscope');
  });


  if (!horoscopePlan) {

    const answer = await ask(
      '\nEnter Daily Horoscope plan NUMBER (0 = stop): '
    );

    if (Number(answer) === 0) {
      console.log('\nSTOPPED. No subscription preview created.');
      return;
    }

    const planIndex = Number(answer) - 1;

    if (
      Number.isNaN(planIndex) ||
      planIndex < 0 ||
      planIndex >= plans.length
    ) {
      throw new Error('Invalid plan selection.');
    }

    horoscopePlan = plans[planIndex];
  }


  console.log('\nSELECTED HOROSCOPE PLAN');

  console.dir({
    id: horoscopePlan.id,
    name: horoscopePlan.name,
    displayName: horoscopePlan.displayName,
    price: String(horoscopePlan.price),
    durationDays: horoscopePlan.durationDays,
    features: horoscopePlan.features,
  });


  const previewConfirm = (
    await ask(
      '\nEnable LOCAL horoscope preview for this exact customer? (Y/N): '
    )
  ).trim().toUpperCase();

  if (previewConfirm !== 'Y') {

    console.log('\nPreview not enabled.');
    return;
  }


  // ---------------------------------------------------------
  // BACKUP CURRENT SUBSCRIPTION STATE
  // ---------------------------------------------------------

  const fs = require('fs');

  const oldSubscriptions =
    await prisma.subscription.findMany({
      where: {
        userId: localUser.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  const backupPath =
    `horoscope-preview-backup-${localUser.id}-${Date.now()}.json`;

  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        user: {
          id: localUser.id,
          phone: localUser.phone,
          subscriptionStatus: localUser.subscriptionStatus,
          subscriptionPlanId: localUser.subscriptionPlanId,
        },
        subscriptions: oldSubscriptions,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('\nBACKUP CREATED:');
  console.log(backupPath);


  // ---------------------------------------------------------
  // CREATE LOCAL PREVIEW ENTITLEMENT
  // ---------------------------------------------------------

  const now = new Date();

  const endDate = new Date(
    now.getTime() +
    Math.max(Number(horoscopePlan.durationDays || 30), 1) *
    86400000
  );

  const result = await prisma.$transaction(async (tx) => {

    await tx.subscription.updateMany({
      where: {
        userId: localUser.id,
        subscriptionStatus: 'ACTIVE',
      },
      data: {
        subscriptionStatus: 'EXPIRED',
        expiredAt: now,
      },
    });

    const preview =
      await tx.subscription.create({
        data: {
          userId: localUser.id,
          subscriptionPlanId: horoscopePlan.id,
          subscriptionStatus: 'ACTIVE',
          amount: horoscopePlan.price,
          currency: horoscopePlan.currency,
          startDate: now,
          endDate,
          isTrial: true,
        },
      });

    const updatedUser =
      await tx.user.update({
        where: {
          id: localUser.id,
        },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionPlanId: horoscopePlan.id,
        },
      });

    return {
      preview,
      updatedUser,
    };
  });


  // ---------------------------------------------------------
  // VERIFY FINAL STATE
  // ---------------------------------------------------------

  const verified =
    await prisma.user.findUnique({
      where: {
        id: localUser.id,
      },
      select: {
        id: true,
        supabaseId: true,
        phone: true,
        email: true,
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
  console.log(' HOROSCOPE PREVIEW SUCCESS');
  console.log('==================================================');

  console.dir(verified, {
    depth: null,
  });

  console.log('\nExact logged-in phone identity matched.');
  console.log('Local preview entitlement enabled.');
  console.log('Production Razorpay/paywall code NOT bypassed.');
}


main()
  .catch((error) => {

    console.error('\nFAILED');
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {

    rl.close();
    await prisma.$disconnect();

  });
