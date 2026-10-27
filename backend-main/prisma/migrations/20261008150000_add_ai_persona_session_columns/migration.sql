ALTER TABLE "ai_astro_sessions"
ADD COLUMN IF NOT EXISTS "personaId" TEXT;

ALTER TABLE "ai_astro_conversations"
ADD COLUMN IF NOT EXISTS "personaId" TEXT;

ALTER TABLE "ai_astro_usages"
ADD COLUMN IF NOT EXISTS "personaId" TEXT;