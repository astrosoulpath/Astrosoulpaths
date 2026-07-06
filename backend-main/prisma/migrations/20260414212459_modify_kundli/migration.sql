/*
  Warnings:

  - You are about to drop the column `birthDate` on the `Kundli` table. All the data in the column will be lost.
  - You are about to drop the column `birthTime` on the `Kundli` table. All the data in the column will be lost.
  - Added the required column `dob` to the `Kundli` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tob` to the `Kundli` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Kundli" DROP COLUMN "birthDate",
DROP COLUMN "birthTime",
ADD COLUMN     "dob" TEXT NOT NULL,
ADD COLUMN     "tob" TEXT NOT NULL;
