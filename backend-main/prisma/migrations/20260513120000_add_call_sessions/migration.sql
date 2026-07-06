-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM (
    'INITIATED',
    'RINGING',
    'ACCEPTED',
    'ONGOING',
    'ENDED',
    'REJECTED',
    'MISSED'
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "callerId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_roomId_key" ON "CallSession"("roomId");

-- CreateIndex
CREATE INDEX "CallSession_callerId_idx" ON "CallSession"("callerId");

-- CreateIndex
CREATE INDEX "CallSession_astrologerId_idx" ON "CallSession"("astrologerId");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE INDEX "CallSession_createdAt_idx" ON "CallSession"("createdAt");

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_callerId_fkey"
FOREIGN KEY ("callerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession"
ADD CONSTRAINT "CallSession_astrologerId_fkey"
FOREIGN KEY ("astrologerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;