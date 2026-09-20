-- CreateTable
CREATE TABLE "MarketplaceCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCart_userId_key" ON "MarketplaceCart"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceCart_updatedAt_idx" ON "MarketplaceCart"("updatedAt");

-- CreateIndex
CREATE INDEX "MarketplaceCartItem_productId_idx" ON "MarketplaceCartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCartItem_cartId_productId_key" ON "MarketplaceCartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "MarketplaceAddress_userId_idx" ON "MarketplaceAddress"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceAddress_userId_isDefault_idx" ON "MarketplaceAddress"("userId", "isDefault");

-- AddForeignKey
ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceAddress" ADD CONSTRAINT "MarketplaceAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
