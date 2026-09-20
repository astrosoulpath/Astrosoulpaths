-- CreateTable
CREATE TABLE "kundli_saved_records" (
    "id" TEXT NOT NULL,
    "kundliId" TEXT NOT NULL,
    "createdByAstrologerId" TEXT NOT NULL,
    "customerUserId" TEXT,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "birthPlace" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kundli_saved_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kundli_saved_records_idempotencyKey_key" ON "kundli_saved_records"("idempotencyKey");

-- CreateIndex
CREATE INDEX "kundli_saved_records_kundliId_idx" ON "kundli_saved_records"("kundliId");

-- CreateIndex
CREATE INDEX "kundli_saved_records_createdByAstrologerId_createdAt_idx" ON "kundli_saved_records"("createdByAstrologerId", "createdAt");

-- CreateIndex
CREATE INDEX "kundli_saved_records_customerUserId_createdAt_idx" ON "kundli_saved_records"("customerUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_kundliId_fkey" FOREIGN KEY ("kundliId") REFERENCES "Kundli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_createdByAstrologerId_fkey" FOREIGN KEY ("createdByAstrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kundli_saved_records" ADD CONSTRAINT "kundli_saved_records_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
