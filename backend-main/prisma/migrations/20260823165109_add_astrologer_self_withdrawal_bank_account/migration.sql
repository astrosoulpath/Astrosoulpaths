-- AlterTable
ALTER TABLE "astrologer_payouts" ADD COLUMN     "bankAccountId" TEXT;

-- CreateTable
CREATE TABLE "astrologer_bank_accounts" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bankName" TEXT,
    "providerContactId" TEXT,
    "providerFundAccountId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_bank_accounts_providerContactId_key" ON "astrologer_bank_accounts"("providerContactId");

-- CreateIndex
CREATE UNIQUE INDEX "astrologer_bank_accounts_providerFundAccountId_key" ON "astrologer_bank_accounts"("providerFundAccountId");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_astrologerId_idx" ON "astrologer_bank_accounts"("astrologerId");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_isActive_idx" ON "astrologer_bank_accounts"("isActive");

-- CreateIndex
CREATE INDEX "astrologer_bank_accounts_createdAt_idx" ON "astrologer_bank_accounts"("createdAt");

-- CreateIndex
CREATE INDEX "astrologer_payouts_bankAccountId_idx" ON "astrologer_payouts"("bankAccountId");

-- AddForeignKey
ALTER TABLE "astrologer_payouts" ADD CONSTRAINT "astrologer_payouts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "astrologer_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_bank_accounts" ADD CONSTRAINT "astrologer_bank_accounts_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
