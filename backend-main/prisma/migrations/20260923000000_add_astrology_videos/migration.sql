CREATE TABLE "AstrologyVideo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "youtubeUrl" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'ASTROLOGY_LESSONS',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "visibilityCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AstrologyVideoTranslation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "videoId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "captionUrl" TEXT,
    "audioLocale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyVideoTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologyVideo_youtubeVideoId_key"
ON "AstrologyVideo"("youtubeVideoId");

CREATE INDEX "AstrologyVideo_isPublished_sortOrder_idx"
ON "AstrologyVideo"("isPublished", "sortOrder");

CREATE INDEX "AstrologyVideo_category_isPublished_idx"
ON "AstrologyVideo"("category", "isPublished");

CREATE UNIQUE INDEX "AstrologyVideoTranslation_videoId_locale_key"
ON "AstrologyVideoTranslation"("videoId", "locale");

CREATE INDEX "AstrologyVideoTranslation_locale_idx"
ON "AstrologyVideoTranslation"("locale");

ALTER TABLE "AstrologyVideoTranslation"
ADD CONSTRAINT "AstrologyVideoTranslation_videoId_fkey"
FOREIGN KEY ("videoId") REFERENCES "AstrologyVideo"("id")
ON DELETE CASCADE ON UPDATE CASCADE;