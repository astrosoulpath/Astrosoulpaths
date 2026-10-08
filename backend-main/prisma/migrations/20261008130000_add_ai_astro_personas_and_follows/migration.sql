CREATE TABLE IF NOT EXISTS "ai_astro_personas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "initials" TEXT,
    "categories" TEXT[] NOT NULL,
    "languages" TEXT[] NOT NULL DEFAULT ARRAY['English', 'Hindi']::TEXT[],
    "expertise" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pricingMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "pricePerMinute" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_astro_personas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_astro_personas_code_key"
ON "ai_astro_personas"("code");

CREATE INDEX IF NOT EXISTS "ai_astro_personas_isEnabled_sortOrder_idx"
ON "ai_astro_personas"("isEnabled", "sortOrder");

CREATE TABLE IF NOT EXISTS "AiAstroFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiAstroFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiAstroFollow_followerId_personaId_key"
ON "AiAstroFollow"("followerId", "personaId");

CREATE INDEX IF NOT EXISTS "AiAstroFollow_followerId_idx"
ON "AiAstroFollow"("followerId");

CREATE INDEX IF NOT EXISTS "AiAstroFollow_personaId_idx"
ON "AiAstroFollow"("personaId");

ALTER TABLE "AiAstroFollow"
ADD CONSTRAINT "AiAstroFollow_followerId_fkey"
FOREIGN KEY ("followerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiAstroFollow"
ADD CONSTRAINT "AiAstroFollow_personaId_fkey"
FOREIGN KEY ("personaId") REFERENCES "ai_astro_personas"("id")
ON DELETE CASCADE ON UPDATE CASCADE;