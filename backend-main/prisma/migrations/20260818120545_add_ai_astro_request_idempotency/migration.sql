/*
  Warnings:

  - A unique constraint covering the columns `[userId,clientRequestId]` on the table `ai_astro_usages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientRequestId` to the `ai_astro_usages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ai_astro_usages" ADD COLUMN     "clientRequestId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ai_astro_usages_userId_clientRequestId_key" ON "ai_astro_usages"("userId", "clientRequestId");
