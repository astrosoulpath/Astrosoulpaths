-- CreateTable
CREATE TABLE "AstrologerAvailability" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstrologerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AstrologerAvailability_astrologerId_idx" ON "AstrologerAvailability"("astrologerId");

-- CreateIndex
CREATE UNIQUE INDEX "AstrologerAvailability_astrologerId_dayOfWeek_key" ON "AstrologerAvailability"("astrologerId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "AstrologerAvailability" ADD CONSTRAINT "AstrologerAvailability_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
