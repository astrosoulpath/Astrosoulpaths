-- Identify free-chat consultation bookings.
ALTER TABLE "CallSession"
ADD COLUMN "isFreeChat" BOOLEAN NOT NULL DEFAULT false;

-- Every newly granted free-chat benefit is one minute.
ALTER TABLE "User"
ALTER COLUMN "freeChatMinutes" SET DEFAULT 1;

-- Normalize only currently unused benefits.
-- Used benefits are not reactivated.
UPDATE "User"
SET "freeChatMinutes" = 1
WHERE "freeChatGrantedAt" IS NOT NULL
  AND "freeChatUsedAt" IS NULL;