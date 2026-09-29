-- AlterTable
ALTER TABLE "ai_consultant_types" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "LiveMessage" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveMessage_liveSessionId_createdAt_idx" ON "LiveMessage"("liveSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveMessage_userId_idx" ON "LiveMessage"("userId");

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMessage" ADD CONSTRAINT "LiveMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ai_astro_conversations_userId_astrologerId_consultantTypeCode_u" RENAME TO "ai_astro_conversations_userId_astrologerId_consultantTypeCo_idx";
