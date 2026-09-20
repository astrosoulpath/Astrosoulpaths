-- CreateTable
CREATE TABLE "ai_astro_sessions" (
    "id" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "consultantTypeCode" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL DEFAULT 'PER_MINUTE',
    "ratePerMinute" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reservedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "chargedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "billableSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_sessions_clientSessionId_key"
ON "ai_astro_sessions"("clientSessionId");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_userId_status_idx"
ON "ai_astro_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_astrologerId_status_idx"
ON "ai_astro_sessions"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "ai_astro_sessions_lastHeartbeatAt_idx"
ON "ai_astro_sessions"("lastHeartbeatAt");