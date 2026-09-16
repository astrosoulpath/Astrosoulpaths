const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.marketplaceProduct.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    include: {
      category: true,
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
      astrologer: {
        include: {
          user: {
            select: {
              name: true,
              isActive: true,
              isBlocked: true,
            },
          },
          marketplaceSellerProfile: true,
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
        categoryActive: p.category?.isActive ?? null,
        imageCount: p.images.length,
        primaryImage:
          p.images.find((img) => img.isPrimary)?.imageUrl ??
          p.images[0]?.imageUrl ??
          null,
        astrologerApproved: p.astrologer?.isApproved ?? null,
        astrologerVerified: p.astrologer?.isVerified ?? null,
        sellerStatus:
          p.astrologer?.marketplaceSellerProfile?.status ?? null,
        userActive: p.astrologer?.user?.isActive ?? null,
        userBlocked: p.astrologer?.user?.isBlocked ?? null,
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
