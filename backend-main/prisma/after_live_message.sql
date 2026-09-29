-- AlterTable
ALTER TABLE "ai_consultant_types" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "ai_astro_conversations_userId_astrologerId_consultantTypeCode_u" RENAME TO "ai_astro_conversations_userId_astrologerId_consultantTypeCo_idx";
