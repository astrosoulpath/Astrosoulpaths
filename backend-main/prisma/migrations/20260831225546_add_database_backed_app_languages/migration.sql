CREATE TABLE "app_languages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_languages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_languages_code_key"
ON "app_languages"("code");

CREATE INDEX "app_languages_isActive_sortOrder_idx"
ON "app_languages"("isActive", "sortOrder");