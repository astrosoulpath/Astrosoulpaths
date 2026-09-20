CREATE TABLE "app_translations" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_translations_languageCode_key_key"
ON "app_translations"("languageCode", "key");

CREATE INDEX "app_translations_languageCode_isActive_idx"
ON "app_translations"("languageCode", "isActive");