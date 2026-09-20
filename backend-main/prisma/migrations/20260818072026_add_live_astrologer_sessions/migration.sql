-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveViewer" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LiveViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_channelName_key" ON "LiveSession"("channelName");

-- CreateIndex
CREATE INDEX "LiveSession_astrologerId_status_idx" ON "LiveSession"("astrologerId", "status");

-- CreateIndex
CREATE INDEX "LiveSession_status_startedAt_idx" ON "LiveSession"("status", "startedAt");

-- CreateIndex
CREATE INDEX "LiveViewer_liveSessionId_leftAt_idx" ON "LiveViewer"("liveSessionId", "leftAt");

-- CreateIndex
CREATE INDEX "LiveViewer_userId_leftAt_idx" ON "LiveViewer"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "LiveViewer_liveSessionId_userId_idx" ON "LiveViewer"("liveSessionId", "userId");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
