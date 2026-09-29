CREATE TABLE "AstrologyArticle" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "category" TEXT NOT NULL DEFAULT 'ASTROLOGY',
  "festivalTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "defaultLocale" TEXT NOT NULL DEFAULT 'en',
  "visibilityCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AstrologyArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AstrologyArticleTranslation" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "contentMarkdown" TEXT NOT NULL,
  "authorName" TEXT,
  "readingMinutes" INTEGER NOT NULL DEFAULT 3,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AstrologyArticleTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologyArticle_slug_key" ON "AstrologyArticle"("slug");
CREATE INDEX "AstrologyArticle_isPublished_sortOrder_idx" ON "AstrologyArticle"("isPublished", "sortOrder");
CREATE INDEX "AstrologyArticle_category_isPublished_idx" ON "AstrologyArticle"("category", "isPublished");
CREATE INDEX "AstrologyArticle_publishedAt_idx" ON "AstrologyArticle"("publishedAt");
CREATE INDEX "AstrologyArticleTranslation_locale_idx" ON "AstrologyArticleTranslation"("locale");
CREATE UNIQUE INDEX "AstrologyArticleTranslation_articleId_locale_key" ON "AstrologyArticleTranslation"("articleId", "locale");

ALTER TABLE "AstrologyArticleTranslation"
  ADD CONSTRAINT "AstrologyArticleTranslation_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "AstrologyArticle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;