-- CreateEnum
CREATE TYPE "AstrologerEarningStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "AstrologerPayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "astrologer_earnings" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "AstrologerEarningStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_payouts" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "AstrologerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_earnings_callSessionId_key" ON "astrologer_earnings"("callSessionId");

-- CreateIndex
CREATE INDEX "astrologer_earnings_astrologerId_idx" ON "astrologer_earnings"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_earnings_status_idx" ON "astrologer_earnings"("status");

-- CreateIndex
CREATE INDEX "astrologer_earnings_createdAt_idx" ON "astrologer_earnings"("createdAt");

-- CreateIndex
CREATE INDEX "astrologer_payouts_astrologerId_idx" ON "astrologer_payouts"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_payouts_status_idx" ON "astrologer_payouts"("status");

-- CreateIndex
CREATE INDEX "astrologer_payouts_createdAt_idx" ON "astrologer_payouts"("createdAt");

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_payouts" ADD CONSTRAINT "astrologer_payouts_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
