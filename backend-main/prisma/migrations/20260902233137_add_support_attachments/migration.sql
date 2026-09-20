CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_attachments_storagePath_key"
ON "support_attachments"("storagePath");

CREATE INDEX "support_attachments_ticketId_createdAt_idx"
ON "support_attachments"("ticketId", "createdAt");

ALTER TABLE "support_attachments"
ADD CONSTRAINT "support_attachments_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "support_tickets"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;