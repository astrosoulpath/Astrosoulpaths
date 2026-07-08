/*
  Warnings:

  - You are about to drop the column `boyProfileId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `girlProfileId` on the `Match` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[boyId,girlId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `boyId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `girlId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_boyProfileId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_girlProfileId_fkey";

-- DropIndex
DROP INDEX "Match_boyProfileId_idx";

-- DropIndex
DROP INDEX "Match_girlProfileId_idx";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "boyProfileId",
DROP COLUMN "girlProfileId",
ADD COLUMN     "boyId" TEXT NOT NULL,
ADD COLUMN     "girlId" TEXT NOT NULL,
ADD COLUMN     "isSaved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Match_boyId_idx" ON "Match"("boyId");

-- CreateIndex
CREATE INDEX "Match_girlId_idx" ON "Match"("girlId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_boyId_girlId_key" ON "Match"("boyId", "girlId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_boyId_fkey" FOREIGN KEY ("boyId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_girlId_fkey" FOREIGN KEY ("girlId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
