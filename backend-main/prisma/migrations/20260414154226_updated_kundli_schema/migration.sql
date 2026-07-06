/*
  Warnings:

  - You are about to drop the column `birthPlace` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `isFavorite` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `kundliDataId` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `lastViewedAt` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `searchText` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `storageType` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `antardashas` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `birthDate` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `birthTime` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `currentMahaDashaFull` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `hitCount` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `kundliKey` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `mahadashaPrediction` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `mangalDosha` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `timezone` on the `KundliData` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `Kundli` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[kundliId]` on the table `KundliData` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hash` to the `Kundli` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kundliId` to the `KundliData` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Kundli" DROP CONSTRAINT "Kundli_kundliDataId_fkey";

-- DropForeignKey
ALTER TABLE "Kundli" DROP CONSTRAINT "Kundli_userId_fkey";

-- DropIndex
DROP INDEX "Kundli_fullName_idx";

-- DropIndex
DROP INDEX "Kundli_searchText_idx";

-- DropIndex
DROP INDEX "Kundli_userId_idx";

-- DropIndex
DROP INDEX "KundliData_kundliKey_idx";

-- DropIndex
DROP INDEX "KundliData_kundliKey_key";

-- AlterTable
ALTER TABLE "Kundli" DROP COLUMN "birthPlace",
DROP COLUMN "fullName",
DROP COLUMN "gender",
DROP COLUMN "isDeleted",
DROP COLUMN "isFavorite",
DROP COLUMN "kundliDataId",
DROP COLUMN "lastViewedAt",
DROP COLUMN "searchText",
DROP COLUMN "storageType",
DROP COLUMN "summary",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
DROP COLUMN "viewCount",
ADD COLUMN     "hash" TEXT NOT NULL,
ALTER COLUMN "birthDate" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "KundliData" DROP COLUMN "antardashas",
DROP COLUMN "birthDate",
DROP COLUMN "birthTime",
DROP COLUMN "currentMahaDashaFull",
DROP COLUMN "hitCount",
DROP COLUMN "kundliKey",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "mahadashaPrediction",
DROP COLUMN "mangalDosha",
DROP COLUMN "timezone",
ADD COLUMN     "antardasha" JSONB,
ADD COLUMN     "currentMahaDasha" JSONB,
ADD COLUMN     "kundliId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Kundli_hash_key" ON "Kundli"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "KundliData_kundliId_key" ON "KundliData"("kundliId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");

-- AddForeignKey
ALTER TABLE "KundliData" ADD CONSTRAINT "KundliData_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
