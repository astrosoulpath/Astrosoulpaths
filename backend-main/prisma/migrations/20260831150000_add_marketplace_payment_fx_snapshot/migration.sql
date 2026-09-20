ALTER TABLE "MarketplaceOrder"
ADD COLUMN "paymentCountryCode" TEXT,
ADD COLUMN "paymentCurrency" TEXT,
ADD COLUMN "paymentAmount" DECIMAL(18,6),
ADD COLUMN "paymentFxRate" DECIMAL(18,8),
ADD COLUMN "paymentFxQuotedAt" TIMESTAMP(3),
ADD COLUMN "razorpayAmountSubunits" DECIMAL(20,0);