-- Marketplace Razorpay payment tracking foundation.
-- No payment is executed by this migration.

ALTER TABLE "MarketplaceOrder"
ADD COLUMN "razorpayOrderId" TEXT,
ADD COLUMN "razorpayPaymentId" TEXT,
ADD COLUMN "razorpaySignature" TEXT,
ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN "paymentWebhookEventId" TEXT;

CREATE UNIQUE INDEX "MarketplaceOrder_razorpayOrderId_key"
ON "MarketplaceOrder"("razorpayOrderId");

CREATE UNIQUE INDEX "MarketplaceOrder_razorpayPaymentId_key"
ON "MarketplaceOrder"("razorpayPaymentId");

CREATE UNIQUE INDEX "MarketplaceOrder_paymentWebhookEventId_key"
ON "MarketplaceOrder"("paymentWebhookEventId");