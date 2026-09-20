-- Marketplace prepare-order idempotency.
-- Existing orders remain valid because the new column is nullable.

ALTER TABLE "MarketplaceOrder"
ADD COLUMN "prepareIdempotencyKey" TEXT;

CREATE UNIQUE INDEX "MarketplaceOrder_customerUserId_prepareIdempotencyKey_key"
ON "MarketplaceOrder"("customerUserId", "prepareIdempotencyKey");