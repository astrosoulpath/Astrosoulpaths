const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ======================
  // Roles
  // ======================

  await prisma.role.createMany({
    data: [
      {
        id: 'customer',
        name: 'CUSTOMER',
        description: 'Customer user role',
      },
      {
        id: 'astrologer',
        name: 'ASTROLOGER',
        description: 'Astrologer role',
      },
      {
        id: 'admin',
        name: 'ADMIN',
        description: 'Admin role',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Roles seeded');

  // ======================
  // Existing Subscription Plans
  // ======================

  await prisma.subscriptionPlan.createMany({
    data: [
      {
        name: 'FREE',
        displayName: 'Free Plan',
        description: 'Basic astrology access',
        price: 0,
        currency: 'INR',
        durationDays: 3650,
        features: {
          chatLimitPerDay: 3,
          personalizedPredictions: false,
        },
        isActive: true,
        isFeatured: false,
      },
      {
        name: 'GOLD',
        displayName: 'Gold Plan',
        description: 'Premium astrology access',
        price: 499,
        currency: 'INR',
        durationDays: 30,
        features: {
          chatLimitPerDay: 7,
          liveChat: true,
        },
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'PREMIUM',
        displayName: 'Premium Plan',
        description: 'VIP astrology access',
        price: 999,
        currency: 'INR',
        durationDays: 30,
        features: {
          chatLimitPerDay: -1,
          vipAstrologers: true,
        },
        isActive: true,
        isFeatured: true,
      },
    ],
    skipDuplicates: true,
  });

  // ======================
  // Customer Daily Horoscope Plan
  // ======================

  await prisma.subscriptionPlan.upsert({
    where: {
      name: 'DAILY_HOROSCOPE_MONTHLY',
    },
    update: {
      displayName: 'Personalized Daily Horoscope - Monthly',
      description:
        'Personalized Vedic daily horoscope delivered every day for customers worldwide',
      price: 1,
      currency: 'USD',
      durationDays: 30,
      features: {
        portal: 'customer',
        personalizedDailyHoroscope: true,
        vedicAstrology: true,
        dailyDelivery: true,
        worldwideAccess: true,
        autoRenewalEligible: true,
      },
      isActive: true,
      isFeatured: true,
    },
    create: {
      name: 'DAILY_HOROSCOPE_MONTHLY',
      displayName: 'Personalized Daily Horoscope - Monthly',
      description:
        'Personalized Vedic daily horoscope delivered every day for customers worldwide',
      price: 1,
      currency: 'USD',
      durationDays: 30,
      features: {
        portal: 'customer',
        personalizedDailyHoroscope: true,
        vedicAstrology: true,
        dailyDelivery: true,
        worldwideAccess: true,
        autoRenewalEligible: true,
      },
      isActive: true,
      isFeatured: true,
    },
  });
  // ======================
  // ASP Professional Kundli Plan
  // ======================

  await prisma.subscriptionPlan.upsert({
    where: {
      name: 'ASTROLOGER_KUNDLI_YEARLY',
    },
    update: {
      displayName: 'Professional Kundli - Yearly',
      description:
        'Worldwide professional Kundli generation and customer chart management for astrologers',
      price: 3000,
      currency: 'INR',
      durationDays: 365,
      features: {
        portal: 'astrologer',
        worldwideAccess: true,
        unlimitedKundliGeneration: true,
        detailedKundliReports: true,
        saveCustomerCharts: true,
        downloadPdfReports: true,
        printReports: true,
        includedCharts: ['D1', 'D9'],
        basicDashaAnalysis: true,
      },
      isActive: true,
      isFeatured: true,
    },
    create: {
      name: 'ASTROLOGER_KUNDLI_YEARLY',
      displayName: 'Professional Kundli - Yearly',
      description:
        'Worldwide professional Kundli generation and customer chart management for astrologers',
      price: 3000,
      currency: 'INR',
      durationDays: 365,
      features: {
        portal: 'astrologer',
        worldwideAccess: true,
        unlimitedKundliGeneration: true,
        detailedKundliReports: true,
        saveCustomerCharts: true,
        downloadPdfReports: true,
        printReports: true,
        includedCharts: ['D1', 'D9'],
        basicDashaAnalysis: true,
      },
      isActive: true,
      isFeatured: true,
    },
  });

  console.log('✅ Subscription plans seeded');

  // ======================
  // Verify Admin Role
  // ======================

  const adminRole = await prisma.role.findUnique({
    where: {
      id: 'admin',
    },
  });

  if (!adminRole) {
    throw new Error('Admin role missing');
  }

  console.log('✅ Admin role ready');
  console.log('🎉 Database seed completed');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
