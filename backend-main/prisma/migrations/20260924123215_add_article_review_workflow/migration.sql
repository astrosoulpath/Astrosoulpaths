DO $$ BEGIN
  CREATE TYPE "ArticlePublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ArticleAuthorType" AS ENUM ('ADMIN', 'ASTROLOGER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AstrologyArticle"
  ADD COLUMN IF NOT EXISTS "authorType" "ArticleAuthorType" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "status" "ArticlePublicationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "submittedByAstrologerId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

UPDATE "AstrologyArticle"
SET "authorType" = 'ADMIN', "status" = 'PUBLISHED'
WHERE "isPublished" = true;

CREATE INDEX IF NOT EXISTS "AstrologyArticle_status_sortOrder_idx"
ON "AstrologyArticle"("status", "sortOrder");