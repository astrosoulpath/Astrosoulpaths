/*
  Warnings:

  - A unique constraint covering the columns `[kundliId,lang]` on the table `KundliData` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "KundliData" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE UNIQUE INDEX "KundliData_kundliId_lang_key" ON "KundliData"("kundliId", "lang");
