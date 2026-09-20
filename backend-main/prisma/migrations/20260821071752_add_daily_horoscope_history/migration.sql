-- CreateTable
CREATE TABLE "daily_horoscope_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "requestedDay" TEXT NOT NULL,
    "vedic" JSONB NOT NULL,
    "ai" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "providerSource" TEXT NOT NULL,
    "aiModel" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_horoscope_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_horoscope_history_userId_targetDate_idx" ON "daily_horoscope_history"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "daily_horoscope_history_generatedAt_idx" ON "daily_horoscope_history"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_horoscope_history_userId_targetDate_key" ON "daily_horoscope_history"("userId", "targetDate");

-- AddForeignKey
ALTER TABLE "daily_horoscope_history" ADD CONSTRAINT "daily_horoscope_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
