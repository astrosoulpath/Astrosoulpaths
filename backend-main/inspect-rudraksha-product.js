require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.marketplaceProduct.findMany({
    where: { name: { contains: 'Rudraksha 4', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      shortDescription: true,
      description: true,
      currency: true,
      mrp: true,
      sellingPrice: true,
      status: true,
    },
  });

  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
