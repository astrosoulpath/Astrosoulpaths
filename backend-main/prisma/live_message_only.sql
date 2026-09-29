CREATE TABLE "LiveMessage" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveMessage_liveSessionId_createdAt_idx"
ON "LiveMessage"("liveSessionId", "createdAt");

CREATE INDEX "LiveMessage_userId_idx"
ON "LiveMessage"("userId");

ALTER TABLE "LiveMessage"
ADD CONSTRAINT "LiveMessage_liveSessionId_fkey"
FOREIGN KEY ("liveSessionId")
REFERENCES "LiveSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveMessage"
ADD CONSTRAINT "LiveMessage_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
