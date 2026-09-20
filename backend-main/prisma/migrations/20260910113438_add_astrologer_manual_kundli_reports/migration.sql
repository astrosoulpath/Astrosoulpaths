-- CreateEnum
CREATE TYPE "AstrologerKundliReportStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "astrologer_kundli_reports" (
    "id" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "status" "AstrologerKundliReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "summary" TEXT,
    "character" TEXT,
    "career" TEXT,
    "marriage" TEXT,
    "finance" TEXT,
    "health" TEXT,
    "remedies" TEXT,
    "notes" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_kundli_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_kundli_report_attachments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astrologer_kundli_report_attachments_pkey" PRIMARY KEY ("id")
);

-- One canonical professional report per consultation.
CREATE UNIQUE INDEX "astrologer_kundli_reports_callSessionId_key"
ON "astrologer_kundli_reports"("callSessionId");

CREATE INDEX "astrologer_kundli_reports_customerUserId_status_createdAt_idx"
ON "astrologer_kundli_reports"("customerUserId", "status", "createdAt");

CREATE INDEX "astrologer_kundli_reports_astrologerId_status_createdAt_idx"
ON "astrologer_kundli_reports"("astrologerId", "status", "createdAt");

CREATE INDEX "astrologer_kundli_report_attachments_reportId_createdAt_idx"
ON "astrologer_kundli_report_attachments"("reportId", "createdAt");

-- Foreign keys
ALTER TABLE "astrologer_kundli_reports"
ADD CONSTRAINT "astrologer_kundli_reports_callSessionId_fkey"
FOREIGN KEY ("callSessionId")
REFERENCES "CallSession"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "astrologer_kundli_reports"
ADD CONSTRAINT "astrologer_kundli_reports_customerUserId_fkey"
FOREIGN KEY ("customerUserId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "astrologer_kundli_reports"
ADD CONSTRAINT "astrologer_kundli_reports_astrologerId_fkey"
FOREIGN KEY ("astrologerId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "astrologer_kundli_report_attachments"
ADD CONSTRAINT "astrologer_kundli_report_attachments_reportId_fkey"
FOREIGN KEY ("reportId")
REFERENCES "astrologer_kundli_reports"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;