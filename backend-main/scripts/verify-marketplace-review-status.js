const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.marketplaceProduct.findFirst({
    where: { sku: 'Test-01' },
    include: {
      images: true,
      category: true,
    },
  });

  console.log(JSON.stringify({
    id: product?.id,
    name: product?.name,
    sku: product?.sku,
    status: product?.status,
    submittedAt: product?.submittedAt,
    imageCount: product?.images?.length ?? 0,
    category: product?.category?.name ?? null,
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
