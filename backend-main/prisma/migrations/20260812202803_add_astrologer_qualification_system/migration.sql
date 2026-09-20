-- CreateTable
CREATE TABLE "AstrologerQualificationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER NOT NULL DEFAULT 10,
    "passingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "allowRetake" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER,
    "retakeCooldownMins" INTEGER NOT NULL DEFAULT 0,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT true,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT false,
    "showScore" BOOLEAN NOT NULL DEFAULT true,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerQualificationQuestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "category" TEXT,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AstrologerQualificationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "passingScore" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerQualificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AstrologerQualificationQuestion_isActive_sortOrder_idx" ON "AstrologerQualificationQuestion"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AstrologerQualificationQuestion_category_idx" ON "AstrologerQualificationQuestion"("category");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_userId_idx" ON "AstrologerQualificationAttempt"("userId");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_userId_passed_idx" ON "AstrologerQualificationAttempt"("userId", "passed");

-- CreateIndex
CREATE INDEX "AstrologerQualificationAttempt_createdAt_idx" ON "AstrologerQualificationAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "AstrologerQualificationAttempt" ADD CONSTRAINT "AstrologerQualificationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
