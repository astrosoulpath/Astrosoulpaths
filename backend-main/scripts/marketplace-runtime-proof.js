const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.marketplaceProduct.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      category: true,
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        status: p.status,
        stock: p.stock,
        category: p.category?.name ?? null,
        imageCount: p.images.length,
        images: p.images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          isPrimary: img.isPrimary,
          sortOrder: img.sortOrder,
        })),
      })),
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
