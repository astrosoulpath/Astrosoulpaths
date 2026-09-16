const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.marketplaceProduct.findMany({
    where: {
      status: 'ACTIVE',
      stock: { gt: 0 },
      images: { some: {} },
    },
    include: {
      images: {
        orderBy: { sortOrder: 'asc' },
      },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(JSON.stringify(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      status: p.status,
      stock: p.stock,
      category: p.category?.name ?? null,
      imageCount: p.images.length,
      primaryImage: p.images[0]?.imageUrl ?? null,
    })),
    null,
    2
  ));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
