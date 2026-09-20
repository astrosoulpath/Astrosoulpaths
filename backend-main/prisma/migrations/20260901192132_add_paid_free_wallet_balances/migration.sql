ALTER TABLE "wallets"
ADD COLUMN "paidBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "freeBalance" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "wallets"
SET
  "paidBalance" = "balance",
  "freeBalance" = 0;
