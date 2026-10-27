const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const names = [
  ['KUNDLI_GUIDE', 'Kundli Guide AI', 'Kundli & birth-chart guidance'],
  ['VEDIC_WISDOM', 'Vedic Wisdom AI', 'Vedic astrology guidance'],
  ['CAREER_COMPASS', 'Career Compass AI', 'Career & growth guidance'],
  ['LOVE_HARMONY', 'Love Harmony AI', 'Love & relationship guidance'],
  ['COSMIC_TIMING', 'Cosmic Timing AI', 'Dasha & transit guidance'],
  ['NUMEROLOGY_INSIGHT', 'Numerology Insight AI', 'Numbers & destiny guidance'],
  ['MARRIAGE_PATH', 'Marriage Path AI', 'Marriage & compatibility guidance'],
  ['FINANCE_FLOW', 'Finance Flow AI', 'Finance & prosperity guidance'],
  ['WELLNESS_BALANCE', 'Wellness Balance AI', 'Wellness & mindful guidance'],
  ['SPIRITUAL_PATH', 'Spiritual Path AI', 'Spiritual growth guidance'],
];

async function main() {
  const execute = process.argv.includes('--execute');

  for (const [index, [code, name, subtitle]] of names.entries()) {
    const data = {
      name,
      subtitle,
      description: `AI guidance for ${subtitle.toLowerCase()}.`,
      categories: ({
        KUNDLI_GUIDE: ['LOVE', 'MARRIAGE', 'CAREER', 'FINANCE'],
        VEDIC_WISDOM: ['LOVE', 'MARRIAGE', 'CAREER', 'HEALTH', 'FINANCE'],
        CAREER_COMPASS: ['CAREER', 'BUSINESS', 'EDUCATION'],
        LOVE_HARMONY: ['LOVE', 'MARRIAGE'],
        COSMIC_TIMING: ['CAREER', 'BUSINESS', 'MARRIAGE'],
        NUMEROLOGY_INSIGHT: ['CAREER', 'BUSINESS', 'LOVE'],
        MARRIAGE_PATH: ['MARRIAGE', 'LOVE'],
        FINANCE_FLOW: ['FINANCE', 'BUSINESS'],
        WELLNESS_BALANCE: ['HEALTH'],
        SPIRITUAL_PATH: ['HEALTH', 'LOVE'],
      })[code],
      languages: ['English', 'Hindi'],
      expertise: [subtitle],
      sortOrder: index + 1,
      isEnabled: true,
      isFree: ['KUNDLI_GUIDE', 'VEDIC_WISDOM'].includes(code),
      pricingMode: 'PER_MINUTE',
      pricePerMinute: ['KUNDLI_GUIDE', 'VEDIC_WISDOM'].includes(code) ? null : 21,
    };

    if (execute) {
      await prisma.aiAstroPersona.upsert({
        where: { code },
        create: { code, ...data },
        update: {},
      });
    }

    console.log(`${execute ? 'SEEDED' : 'PREVIEW'}: ${code} - ${name}`);
  }

  console.log(execute ? 'Seed complete' : 'Preview only; no DB writes');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());