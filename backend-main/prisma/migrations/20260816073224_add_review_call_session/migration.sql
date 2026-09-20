/*
  Warnings:

  - A unique constraint covering the columns `[callSessionId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `callSessionId` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "callSessionId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Review_callSessionId_key" ON "Review"("callSessionId");

-- CreateIndex
CREATE INDEX "Review_astrologerId_idx" ON "Review"("astrologerId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_callSessionId_fkey" FOREIGN KEY ("callSessionId") REFERENCES "CallSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
