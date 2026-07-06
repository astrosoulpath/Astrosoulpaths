CREATE TYPE "LedgerReferenceType" AS ENUM ('WALLET_RECHARGE', 'CALL_SESSION', 'GIFT', 'KUNDLI_REPORT', 'REFUND');

CREATE TYPE "PaymentType" AS ENUM ('WALLET_RECHARGE', 'KUNDLI_REPORT', 'SUBSCRIPTION', 'GIFT_PURCHASE');

CREATE TYPE "KundliOrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "payment_orders"
ALTER COLUMN "walletId" DROP NOT NULL,
ADD COLUMN     "type" "PaymentType" NOT NULL DEFAULT 'WALLET_RECHARGE',
ADD COLUMN     "metadata" JSONB;

ALTER TABLE "wallet_ledger"
ADD COLUMN     "referenceType_new" "LedgerReferenceType";

UPDATE "wallet_ledger"
SET "referenceType_new" = CASE
  WHEN "referenceType" = 'PAYMENT' THEN 'WALLET_RECHARGE'::"LedgerReferenceType"
  WHEN "referenceType" = 'WALLET_RECHARGE' THEN 'WALLET_RECHARGE'::"LedgerReferenceType"
  WHEN "referenceType" = 'CALL_SESSION' THEN 'CALL_SESSION'::"LedgerReferenceType"
  WHEN "referenceType" = 'GIFT' THEN 'GIFT'::"LedgerReferenceType"
  WHEN "referenceType" = 'KUNDLI_REPORT' THEN 'KUNDLI_REPORT'::"LedgerReferenceType"
  WHEN "referenceType" = 'REFUND' THEN 'REFUND'::"LedgerReferenceType"
  ELSE NULL
END;

ALTER TABLE "wallet_ledger" DROP COLUMN "referenceType";

ALTER TABLE "wallet_ledger" RENAME COLUMN "referenceType_new" TO "referenceType";

CREATE TABLE "KundliOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "kundliId" TEXT,
    "status" "KundliOrderStatus" NOT NULL DEFAULT 'PENDING',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KundliOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KundliOrder_paymentOrderId_key" ON "KundliOrder"("paymentOrderId");

CREATE INDEX "payment_orders_type_idx" ON "payment_orders"("type");

CREATE INDEX "KundliOrder_userId_idx" ON "KundliOrder"("userId");

ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KundliOrder" ADD CONSTRAINT "KundliOrder_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE SET NULL ON UPDATE CASCADE;