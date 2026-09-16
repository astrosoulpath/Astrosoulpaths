const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.marketplaceOrder.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      sellerOrders: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    console.log('No marketplace order found');
    return;
  }

  console.log(JSON.stringify({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    currency: order.currency,
    subtotal: order.subtotal?.toString?.(),
    shippingTotal: order.shippingTotal?.toString?.(),
    grandTotal: order.grandTotal?.toString?.(),
    prepareIdempotencyKey: order.prepareIdempotencyKey,
    createdAt: order.createdAt,
    sellerOrders: order.sellerOrders.map((sellerOrder) => ({
      id: sellerOrder.id,
      status: sellerOrder.status,
      items: sellerOrder.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice?.toString?.(),
        shippingCharge: item.shippingCharge?.toString?.(),
        lineTotal: item.lineTotal?.toString?.(),
      })),
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
