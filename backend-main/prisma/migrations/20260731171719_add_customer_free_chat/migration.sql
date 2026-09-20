-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freeChatGrantedAt" TIMESTAMP(3),
ADD COLUMN     "freeChatMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "freeChatUsedAt" TIMESTAMP(3);
