-- REVIEW ONLY: accurate observed nullable persona baseline for a CLEAN database.
-- Never execute against existing ai_astro_personas / AiAstroFollow tables.
-- Existing database adoption requires separately approved history handling after
-- exact metadata comparison; this file is not an idempotent repair script.
-- Requires public.User to exist. No rows or existing objects are changed here.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public;

CREATE TABLE public."ai_astro_personas" (
  "id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "subtitle" text NOT NULL,
  "description" text NOT NULL,
  "avatarUrl" text,
  "initials" text,
  "categories" text[],
  "languages" text[] DEFAULT ARRAY['English'::text, 'Hindi'::text],
  "expertise" text[] DEFAULT ARRAY[]::text[],
  "rating" double precision NOT NULL DEFAULT 5,
  "totalReviews" integer NOT NULL DEFAULT 0,
  "experience" integer NOT NULL DEFAULT 0,
  "isEnabled" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "pricingMode" text NOT NULL DEFAULT 'PER_MINUTE'::text,
  "isFree" boolean NOT NULL DEFAULT false,
  "pricePerMinute" numeric(12,2),
  "currency" text NOT NULL DEFAULT 'INR'::text,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone NOT NULL,
  CONSTRAINT "ai_astro_personas_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ai_astro_personas_code_key ON public.ai_astro_personas USING btree (code);
CREATE INDEX "ai_astro_personas_isEnabled_sortOrder_idx" ON public.ai_astro_personas USING btree ("isEnabled", "sortOrder");

CREATE TABLE public."AiAstroFollow" (
  "id" text NOT NULL,
  "followerId" text NOT NULL,
  "personaId" text NOT NULL,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAstroFollow_pkey" PRIMARY KEY (id)
);
CREATE INDEX "AiAstroFollow_followerId_idx" ON public."AiAstroFollow" USING btree ("followerId");
CREATE UNIQUE INDEX "AiAstroFollow_followerId_personaId_key" ON public."AiAstroFollow" USING btree ("followerId", "personaId");
CREATE INDEX "AiAstroFollow_personaId_idx" ON public."AiAstroFollow" USING btree ("personaId");

ALTER TABLE public."AiAstroFollow" ADD CONSTRAINT "AiAstroFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public."AiAstroFollow" ADD CONSTRAINT "AiAstroFollow_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES public."ai_astro_personas"(id) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
