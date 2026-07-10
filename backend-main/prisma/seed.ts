import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Roles
  await prisma.role.createMany({
    data: [{ name: 'user' }, { name: 'admin' }, { name: 'astrologer' }],
    skipDuplicates: true,
  });

  console.log('✅ Roles seeded successfully');

  // Seed Subscription Plans
  await prisma.subscriptionPlan.createMany({
    data: [
      {
        name: 'FREE',
        displayName: 'Free Plan',
        description: 'Basic astrology tools with limited AI access',
        price: 0,
        currency: 'INR',
        durationDays: 3650,
        features: {
          chatLimitPerDay: 3,
          personalizedPredictions: false,
          liveChat: false,
          basicAstrologyTools: true,
        },
        isActive: true,
        isFeatured: false,
      },
      {
        name: 'GOLD',
        displayName: 'Gold Plan',
        description: 'More personalized astrology with increased chat access',
        price: 499,
        currency: 'INR',
        durationDays: 30,
        features: {
          chatLimitPerDay: 7,
          personalizedPredictions: true,
          liveChat: true,
          priorityAstrologers: true,
        },
        isActive: true,
        isFeatured: true,
      },
      {
        name: 'PREMIUM',
        displayName: 'Premium Plan',
        description: 'Unlimited astrology experience with VIP access',
        price: 999,
        currency: 'INR',
        durationDays: 30,
        features: {
          chatLimitPerDay: -1,
          personalizedPredictions: true,
          vipAstrologers: true,
          prioritySupport: true,
        },
        isActive: true,
        isFeatured: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Subscription plans seeded successfully');

  // Seed test pending astrologer for Admin Approval flow
  const userRole = await prisma.role.findUnique({
    where: { name: 'user' },
  });

  if (!userRole) {
    throw new Error('User role not found');
  }

  const testUser = await prisma.user.upsert({
    where: { supabaseId: 'seed-astrologer-supabase-id' },
    update: {
      isAstrologer: true,
    },
    create: {
      supabaseId: 'seed-astrologer-supabase-id',
      phone: '+919999999999',
      roleId: userRole.id,
      isAstrologer: true,
    },
  });

  const vedicExpertise = await prisma.expertise.upsert({
    where: { name: 'Vedic Astrology' },
    update: {},
    create: { name: 'Vedic Astrology' },
  });

  const numerologyExpertise = await prisma.expertise.upsert({
    where: { name: 'Numerology' },
    update: {},
    create: { name: 'Numerology' },
  });

  const astrologer = await prisma.astrologer.upsert({
    where: { userId: testUser.id },
    update: {
      bio: 'Experienced astrologer specializing in Vedic astrology and numerology.',
      languages: ['Hindi', 'English'],
      experience: 7,
      pricePerMin: 25,
      isApproved: false,
      isVerified: false,
    },
    create: {
      userId: testUser.id,
      bio: 'Experienced astrologer specializing in Vedic astrology and numerology.',
      languages: ['Hindi', 'English'],
      experience: 7,
      pricePerMin: 25,
      isApproved: false,
      isVerified: false,
      expertise: {
        create: [
          { expertiseId: vedicExpertise.id },
          { expertiseId: numerologyExpertise.id },
        ],
      },
    },
  });

  console.log('✅ Pending astrologer seeded successfully:', astrologer.id);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });