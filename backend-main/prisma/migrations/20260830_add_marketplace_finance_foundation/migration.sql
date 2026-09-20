-- CreateEnum
CREATE TYPE "MarketplaceEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAYOUT_REQUESTED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "MarketplacePayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MarketplaceSellerEarning" (
    "id" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "payoutId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFeePercent" DECIMAL(5,2) NOT NULL,
    "platformFeeAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "status" "MarketplaceEarningStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerPayout" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "MarketplacePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "idempotencyKey" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerEarning_sellerOrderId_key" ON "MarketplaceSellerEarning"("sellerOrderId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_astrologerId_status_idx" ON "MarketplaceSellerEarning"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_payoutId_idx" ON "MarketplaceSellerEarning"("payoutId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerEarning_createdAt_idx" ON "MarketplaceSellerEarning"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerPayout_idempotencyKey_key" ON "MarketplaceSellerPayout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceSellerPayout_astrologerId_status_idx" ON "MarketplaceSellerPayout"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceSellerPayout_createdAt_idx" ON "MarketplaceSellerPayout"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "MarketplaceSellerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerEarning" ADD CONSTRAINT "MarketplaceSellerEarning_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "MarketplaceSellerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerPayout" ADD CONSTRAINT "MarketplaceSellerPayout_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
