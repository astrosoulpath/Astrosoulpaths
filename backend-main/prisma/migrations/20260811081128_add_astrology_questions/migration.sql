-- CreateTable
CREATE TABLE "AstrologyQuestionCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyQuestionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologyQuestion" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AstrologyQuestionCategory_slug_key" ON "AstrologyQuestionCategory"("slug");

-- CreateIndex
CREATE INDEX "AstrologyQuestionCategory_isActive_sortOrder_idx" ON "AstrologyQuestionCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologyQuestion_categoryId_isActive_sortOrder_idx" ON "AstrologyQuestion"("categoryId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "AstrologyQuestion" ADD CONSTRAINT "AstrologyQuestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AstrologyQuestionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
