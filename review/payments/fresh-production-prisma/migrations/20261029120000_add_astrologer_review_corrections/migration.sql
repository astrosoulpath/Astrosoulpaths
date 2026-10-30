-- Additive moderation foundation and correction metadata only.
-- Requires the existing User table. Review existing-table shape before applying.
-- This file is preparation, not authorization to activate or migrate a database.
CREATE TABLE IF NOT EXISTS "AdminModerationSubject" (
  "kind" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminModerationSubject_pkey" PRIMARY KEY ("kind","userId"),
  CONSTRAINT "AdminModerationSubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "AdminModerationAudit" (
  "requestId" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousState" TEXT NOT NULL,
  "nextState" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminModerationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AdminModerationAudit_kind_userId_fkey" FOREIGN KEY ("kind","userId") REFERENCES "AdminModerationSubject"("kind","userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
ALTER TABLE "AdminModerationSubject" ADD COLUMN IF NOT EXISTS "requestedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AdminModerationAudit" ADD COLUMN IF NOT EXISTS "details" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "AdminModerationAudit_kind_userId_version_key" ON "AdminModerationAudit"("kind","userId","version");
CREATE INDEX IF NOT EXISTS "AdminModerationAudit_kind_userId_createdAt_idx" ON "AdminModerationAudit"("kind","userId","createdAt");
