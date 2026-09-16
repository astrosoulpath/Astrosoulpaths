const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const addresses = await prisma.marketplaceAddress.findMany({
    orderBy: [
      { isDefault: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 10,
  });

  console.log(JSON.stringify(
    addresses.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      phone: a.phone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    null,
    2
  ));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
