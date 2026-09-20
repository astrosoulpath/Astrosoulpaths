ALTER TABLE "ai_astro_conversations"
ADD COLUMN IF NOT EXISTS "consultantTypeCode" TEXT;

ALTER TABLE "ai_astro_usages"
ADD COLUMN IF NOT EXISTS "consultantTypeCode" TEXT;

CREATE INDEX IF NOT EXISTS "ai_astro_conversations_userId_astrologerId_consultantTypeCode_updatedAt_idx"
ON "ai_astro_conversations"(
  "userId",
  "astrologerId",
  "consultantTypeCode",
  "updatedAt"
);

CREATE INDEX IF NOT EXISTS "ai_astro_usages_consultantTypeCode_createdAt_idx"
ON "ai_astro_usages"(
  "consultantTypeCode",
  "createdAt"
);