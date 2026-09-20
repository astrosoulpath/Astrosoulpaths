-- AlterTable
ALTER TABLE "astrologer_earnings" ADD COLUMN     "payoutId" TEXT;

-- CreateIndex
CREATE INDEX "astrologer_earnings_payoutId_idx" ON "astrologer_earnings"("payoutId");

-- AddForeignKey
ALTER TABLE "astrologer_earnings" ADD CONSTRAINT "astrologer_earnings_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "astrologer_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
