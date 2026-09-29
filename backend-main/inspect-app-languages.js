require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const languages = await prisma.appLanguage.findMany({
    select: {
      code: true,
      englishName: true,
      nativeName: true,
      isActive: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  console.table(languages);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
