/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `astrologer_payouts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "astrologer_payouts" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "providerStatusDetails" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_payouts_idempotencyKey_key" ON "astrologer_payouts"("idempotencyKey");
