const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.marketplaceProduct.findFirst({
    where: {
      sku: 'Test-01',
    },
    include: {
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
    },
  });

  if (!product) {
    console.log('Rudraksha 4 / Test-01 not found');
    return;
  }

  console.log(JSON.stringify({
    id: product.id,
    name: product.name,
    sku: product.sku,
    status: product.status,
    imageCount: product.images.length,
    images: product.images.map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
