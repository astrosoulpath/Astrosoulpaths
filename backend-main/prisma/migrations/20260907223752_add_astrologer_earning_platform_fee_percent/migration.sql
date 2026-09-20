ALTER TABLE "astrologer_earnings"
ADD COLUMN IF NOT EXISTS "platformFeePercent" DECIMAL(5,2);

UPDATE "astrologer_earnings"
SET "platformFeePercent" =
    CASE
        WHEN "grossAmount" > 0
        THEN ROUND(("platformFee" / "grossAmount") * 100, 2)
        ELSE 0
    END
WHERE "platformFeePercent" IS NULL;

ALTER TABLE "astrologer_earnings"
ALTER COLUMN "platformFeePercent" SET DEFAULT 30;

ALTER TABLE "astrologer_earnings"
ALTER COLUMN "platformFeePercent" SET NOT NULL;