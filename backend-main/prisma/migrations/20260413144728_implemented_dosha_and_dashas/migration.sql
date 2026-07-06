/*
  Warnings:

  - You are about to drop the column `data` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `kundliHash` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `day` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `hour` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `minute` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `month` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the `DailyHoroscope` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VedicKundli` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WesternChart` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `kundliDataId` to the `Kundli` table without a default value. This is not possible if the table is not empty.
  - Made the column `latitude` on table `Kundli` required. This step will fail if there are existing NULL values in that column.
  - Made the column `longitude` on table `Kundli` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `timezone` to the `Kundli` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthDate` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthTime` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('CLOUD', 'LOCAL');

-- DropForeignKey
ALTER TABLE "VedicKundli" DROP CONSTRAINT "VedicKundli_profileId_fkey";

-- DropForeignKey
ALTER TABLE "WesternChart" DROP CONSTRAINT "WesternChart_profileId_fkey";

-- DropIndex
DROP INDEX "Kundli_kundliHash_idx";

-- DropIndex
DROP INDEX "Kundli_kundliHash_key";

-- AlterTable
ALTER TABLE "Kundli" DROP COLUMN "data",
DROP COLUMN "kundliHash",
DROP COLUMN "source",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kundliDataId" TEXT NOT NULL,
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "searchText" TEXT,
ADD COLUMN     "storageType" "StorageType" NOT NULL DEFAULT 'CLOUD',
ADD COLUMN     "summary" JSONB,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "latitude" SET NOT NULL,
ALTER COLUMN "longitude" SET NOT NULL,
DROP COLUMN "timezone",
ADD COLUMN     "timezone" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "day",
DROP COLUMN "hour",
DROP COLUMN "minute",
DROP COLUMN "month",
DROP COLUMN "year",
ADD COLUMN     "birthDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "birthTime" TEXT NOT NULL;

-- DropTable
DROP TABLE "DailyHoroscope";

-- DropTable
DROP TABLE "VedicKundli";

-- DropTable
DROP TABLE "WesternChart";

-- CreateTable
CREATE TABLE "KundliData" (
    "id" TEXT NOT NULL,
    "kundliKey" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthTime" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" DOUBLE PRECISION NOT NULL,
    "manglikDosha" JSONB,
    "mangalDosha" JSONB,
    "kaalSarpDosha" JSONB,
    "pitraDosha" JSONB,
    "mahadasha" JSONB,
    "mahadashaPrediction" JSONB,
    "antardashas" JSONB,
    "mahaDashaTimeline" JSONB,
    "antarDashaTimeline" JSONB,
    "currentMahaDashaFull" JSONB,
    "apiVersion" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KundliData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KundliData_kundliKey_key" ON "KundliData"("kundliKey");

-- CreateIndex
CREATE INDEX "KundliData_kundliKey_idx" ON "KundliData"("kundliKey");

-- CreateIndex
CREATE INDEX "Kundli_fullName_idx" ON "Kundli"("fullName");

-- CreateIndex
CREATE INDEX "Kundli_searchText_idx" ON "Kundli"("searchText");

-- AddForeignKey
ALTER TABLE "Kundli" ADD CONSTRAINT "Kundli_kundliDataId_fkey" FOREIGN KEY ("kundliDataId") REFERENCES "KundliData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
