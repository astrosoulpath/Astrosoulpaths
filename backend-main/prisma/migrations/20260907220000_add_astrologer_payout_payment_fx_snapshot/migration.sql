ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "paymentCountryCode" TEXT;

ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "paymentCurrency" TEXT;

ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "paymentAmount" DECIMAL(18,6);

ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "paymentFxRate" DECIMAL(18,8);

ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "paymentFxQuotedAt" TIMESTAMP(3);

ALTER TABLE "astrologer_payouts"
ADD COLUMN IF NOT EXISTS "razorpayAmountSubunits" DECIMAL(20,0);