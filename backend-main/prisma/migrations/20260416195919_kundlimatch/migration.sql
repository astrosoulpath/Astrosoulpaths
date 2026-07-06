-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "city" TEXT,
ADD COLUMN     "countryCode" TEXT;

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "boyId" TEXT NOT NULL,
    "girlId" TEXT NOT NULL,
    "score" INTEGER,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_boyId_girlId_key" ON "Match"("boyId", "girlId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_boyId_fkey" FOREIGN KEY ("boyId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_girlId_fkey" FOREIGN KEY ("girlId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
