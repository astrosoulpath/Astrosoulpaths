/*
  Warnings:

  - You are about to drop the column `antarDashaTimeline` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `antardasha` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `kaalSarpDosha` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `mahaDashaTimeline` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `mahadasha` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `manglikDosha` on the `KundliData` table. All the data in the column will be lost.
  - You are about to drop the column `pitraDosha` on the `KundliData` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "KundliData" DROP COLUMN "antarDashaTimeline",
DROP COLUMN "antardasha",
DROP COLUMN "kaalSarpDosha",
DROP COLUMN "mahaDashaTimeline",
DROP COLUMN "mahadasha",
DROP COLUMN "manglikDosha",
DROP COLUMN "pitraDosha",
ADD COLUMN     "vedic" JSONB;
