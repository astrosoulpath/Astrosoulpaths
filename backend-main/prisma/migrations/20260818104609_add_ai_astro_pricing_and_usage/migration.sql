-- CreateTable
CREATE TABLE "ai_astro_pricing" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "pricePerQuestion" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_usages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_astro_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_pricing_astrologerId_key" ON "ai_astro_pricing"("astrologerId");

-- CreateIndex
CREATE INDEX "ai_astro_pricing_isEnabled_idx" ON "ai_astro_pricing"("isEnabled");

-- CreateIndex
CREATE INDEX "ai_astro_pricing_isFree_idx" ON "ai_astro_pricing"("isFree");

-- CreateIndex
CREATE INDEX "ai_astro_usages_userId_createdAt_idx" ON "ai_astro_usages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_astro_usages_astrologerId_createdAt_idx" ON "ai_astro_usages"("astrologerId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_astro_usages_userId_isFree_idx" ON "ai_astro_usages"("userId", "isFree");

-- AddForeignKey
ALTER TABLE "ai_astro_pricing" ADD CONSTRAINT "ai_astro_pricing_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_usages" ADD CONSTRAINT "ai_astro_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_usages" ADD CONSTRAINT "ai_astro_usages_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
