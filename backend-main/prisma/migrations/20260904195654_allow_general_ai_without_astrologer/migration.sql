-- General Astro AI foundation
-- Allows platform AI conversations without a fake astrologer persona.
-- Existing specialist AI rows remain unchanged.

ALTER TABLE "ai_astro_sessions"
ALTER COLUMN "astrologerId" DROP NOT NULL;

ALTER TABLE "ai_astro_usages"
ALTER COLUMN "astrologerId" DROP NOT NULL;

ALTER TABLE "ai_astro_conversations"
ALTER COLUMN "astrologerId" DROP NOT NULL;