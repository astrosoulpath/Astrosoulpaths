-- CreateTable
CREATE TABLE "astrology_question_answer_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "kundliHash" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "questionUpdatedAt" TIMESTAMP(3) NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrology_question_answer_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "astrology_question_answer_cache_userId_createdAt_idx" ON "astrology_question_answer_cache"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "astrology_question_answer_cache_questionId_idx" ON "astrology_question_answer_cache"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "astrology_question_answer_cache_userId_questionId_kundliHas_key" ON "astrology_question_answer_cache"("userId", "questionId", "kundliHash", "language", "model", "promptVersion", "questionUpdatedAt");

-- AddForeignKey
ALTER TABLE "astrology_question_answer_cache" ADD CONSTRAINT "astrology_question_answer_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrology_question_answer_cache" ADD CONSTRAINT "astrology_question_answer_cache_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AstrologyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

