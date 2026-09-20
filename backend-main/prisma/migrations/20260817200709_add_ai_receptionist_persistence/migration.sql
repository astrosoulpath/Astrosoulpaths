-- CreateTable
CREATE TABLE "AiReceptionistSession" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerSessionId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'DEMO',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "language" TEXT NOT NULL DEFAULT 'AUTO',
    "customerPhone" TEXT,
    "customerUserId" TEXT,
    "failureReason" TEXT,
    "transferReason" TEXT,
    "transferredTo" TEXT,
    "startedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReceptionistSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReceptionistMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "sequenceNumber" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiReceptionistMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiReceptionistSession_status_idx" ON "AiReceptionistSession"("status");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_provider_idx" ON "AiReceptionistSession"("provider");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_customerUserId_idx" ON "AiReceptionistSession"("customerUserId");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_customerPhone_idx" ON "AiReceptionistSession"("customerPhone");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_createdAt_idx" ON "AiReceptionistSession"("createdAt");

-- CreateIndex
CREATE INDEX "AiReceptionistSession_startedAt_idx" ON "AiReceptionistSession"("startedAt");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_idx" ON "AiReceptionistMessage"("sessionId");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_createdAt_idx" ON "AiReceptionistMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiReceptionistMessage_sessionId_sequenceNumber_idx" ON "AiReceptionistMessage"("sessionId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "AiReceptionistMessage" ADD CONSTRAINT "AiReceptionistMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiReceptionistSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
