const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const categories = [
  {
    slug: 'love-relationship',
    name: 'Love & Relationship',
    description: 'Love, compatibility, breakup, reconciliation and relationship guidance.',
    icon: 'favorite',
    sortOrder: 1,
    questions: [
      'Will my current relationship lead to marriage?',
      'When will I meet my life partner?',
      'Will my ex come back into my life?',
      'Why are there problems in my relationship?',
      'Is my partner compatible with me?',
      'When will my love life improve?',
    ],
  },
  {
    slug: 'marriage',
    name: 'Marriage',
    description: 'Marriage timing, compatibility, delay and married life guidance.',
    icon: 'diamond',
    sortOrder: 2,
    questions: [
      'When will I get married?',
      'Will I have a love marriage or arranged marriage?',
      'Why is my marriage getting delayed?',
      'Will my married life be happy?',
      'Is there any dosha affecting my marriage?',
      'Will I marry my current partner?',
    ],
  },
  {
    slug: 'career-job',
    name: 'Career & Job',
    description: 'Career growth, job change, promotion and professional guidance.',
    icon: 'work',
    sortOrder: 3,
    questions: [
      'When will I get a new job?',
      'Is this the right time to change my job?',
      'When will I get a promotion?',
      'Which career path is best for me?',
      'Will I get a government job?',
      'Will my career improve this year?',
    ],
  },
  {
    slug: 'business',
    name: 'Business',
    description: 'Business growth, partnership, investment and expansion guidance.',
    icon: 'business_center',
    sortOrder: 4,
    questions: [
      'Should I start my own business?',
      'Will my business grow this year?',
      'Is my business partner suitable for me?',
      'Is this a good time to invest in business?',
      'When will my business become profitable?',
    ],
  },
  {
    slug: 'finance-money',
    name: 'Finance & Money',
    description: 'Income, savings, investment and financial stability guidance.',
    icon: 'account_balance_wallet',
    sortOrder: 5,
    questions: [
      'When will my financial situation improve?',
      'Will my income increase soon?',
      'Is this a good time for investment?',
      'Will I be able to clear my debts?',
      'How will my finances be this year?',
    ],
  },
  {
    slug: 'health',
    name: 'Health',
    description: 'General astrology-based health and wellbeing guidance.',
    icon: 'health_and_safety',
    sortOrder: 6,
    questions: [
      'How will my health be this year?',
      'What periods should I be more careful about my health?',
      'When will my health situation improve?',
      'What does my birth chart indicate about my wellbeing?',
    ],
  },
  {
    slug: 'education',
    name: 'Education',
    description: 'Studies, exams, higher education and academic success.',
    icon: 'school',
    sortOrder: 7,
    questions: [
      'Will I succeed in my upcoming exams?',
      'Which field of study is best for me?',
      'Will I get admission to my preferred college?',
      'Is studying abroad suitable for me?',
      'When will my education improve?',
    ],
  },
  {
    slug: 'family',
    name: 'Family',
    description: 'Family relationships, harmony and domestic matters.',
    icon: 'family_restroom',
    sortOrder: 8,
    questions: [
      'When will family problems improve?',
      'How can I improve harmony in my family?',
      'Will my relationship with my family improve?',
      'What does my chart indicate about family life?',
    ],
  },
  {
    slug: 'children',
    name: 'Children',
    description: 'Child-related astrology guidance and family planning questions.',
    icon: 'child_care',
    sortOrder: 9,
    questions: [
      'When are favorable periods for having children?',
      'What does my chart indicate about children?',
      'How will my relationship with my children be?',
    ],
  },
  {
    slug: 'property',
    name: 'Property',
    description: 'Property purchase, house, land and real estate guidance.',
    icon: 'home_work',
    sortOrder: 10,
    questions: [
      'When will I be able to buy a house?',
      'Is this a good time to purchase property?',
      'Will my property investment be beneficial?',
      'When will my property-related issue be resolved?',
    ],
  },
  {
    slug: 'foreign-travel',
    name: 'Foreign Travel',
    description: 'Foreign travel, settlement, visa and overseas opportunities.',
    icon: 'flight_takeoff',
    sortOrder: 11,
    questions: [
      'Will I travel abroad?',
      'Will I settle in a foreign country?',
      'When are my chances of foreign travel strongest?',
      'Will my visa or overseas opportunity succeed?',
    ],
  },
  {
    slug: 'legal',
    name: 'Legal',
    description: 'Astrology-based guidance around ongoing legal matters.',
    icon: 'gavel',
    sortOrder: 12,
    questions: [
      'When will my legal matter improve?',
      'What does my chart indicate about my ongoing dispute?',
      'When is a favorable period for resolution of my legal matter?',
    ],
  },
  {
    slug: 'spirituality',
    name: 'Spirituality',
    description: 'Spiritual growth, purpose, karma and inner guidance.',
    icon: 'self_improvement',
    sortOrder: 13,
    questions: [
      'What is my spiritual path?',
      'What does my chart indicate about my life purpose?',
      'Which spiritual practices are suitable for me?',
      'What karmic patterns are visible in my chart?',
    ],
  },
  {
    slug: 'kundli-dosha',
    name: 'Kundli & Dosha',
    description: 'Kundli, dosha, compatibility and Vedic chart guidance.',
    icon: 'auto_awesome',
    sortOrder: 14,
    questions: [
      'Do I have Manglik Dosha?',
      'Are there important doshas in my Kundli?',
      'What are the strongest planets in my Kundli?',
      'What remedies are suitable according to my Kundli?',
      'How compatible are our Kundlis?',
    ],
  },
  {
    slug: 'other',
    name: 'Other',
    description: 'Ask any other astrology-related question.',
    icon: 'help_outline',
    sortOrder: 15,
    questions: [
      'I want to ask a different astrology question.',
    ],
  },
];

async function main() {
  for (const item of categories) {
    const category = await prisma.astrologyQuestionCategory.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        icon: item.icon,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        icon: item.icon,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });

    for (let index = 0; index < item.questions.length; index++) {
      const text = item.questions[index];

      const existing = await prisma.astrologyQuestion.findFirst({
        where: {
          categoryId: category.id,
          text,
        },
      });

      if (existing) {
        await prisma.astrologyQuestion.update({
          where: { id: existing.id },
          data: {
            sortOrder: index + 1,
            isActive: true,
          },
        });
      } else {
        await prisma.astrologyQuestion.create({
          data: {
            categoryId: category.id,
            text,
            sortOrder: index + 1,
            isActive: true,
          },
        });
      }
    }
  }

  const categoryCount = await prisma.astrologyQuestionCategory.count();
  const questionCount = await prisma.astrologyQuestion.count();

  console.log({
    categoryCount,
    questionCount,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
