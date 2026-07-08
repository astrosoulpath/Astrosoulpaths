/*
  Warnings:

  - You are about to drop the column `boyId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `girlId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `isSaved` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `result` on the `Match` table. All the data in the column will be lost.
  - Added the required column `boyProfileId` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `girlProfileId` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_boyId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_girlId_fkey";

-- DropIndex
DROP INDEX "Match_boyId_girlId_key";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "boyId",
DROP COLUMN "girlId",
DROP COLUMN "isSaved",
DROP COLUMN "result",
ADD COLUMN     "boyProfileId" TEXT NOT NULL,
ADD COLUMN     "girlProfileId" TEXT NOT NULL,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "summary" TEXT,
ALTER COLUMN "score" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "occupation" TEXT;

-- CreateIndex
CREATE INDEX "Match_boyProfileId_idx" ON "Match"("boyProfileId");

-- CreateIndex
CREATE INDEX "Match_girlProfileId_idx" ON "Match"("girlProfileId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_boyProfileId_fkey" FOREIGN KEY ("boyProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_girlProfileId_fkey" FOREIGN KEY ("girlProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
