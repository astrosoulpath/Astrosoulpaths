-- REVIEW ONLY. Additive successor to pinned Stage 2 DDL; no existing DB execution.
ALTER TABLE public."SmartNotificationPolicy"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "controlVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "scheduleMinute" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE public."SmartNotificationPolicy"
  ADD CONSTRAINT "SmartPolicy_control_version_check" CHECK ("controlVersion">0),
  ADD CONSTRAINT "SmartPolicy_schedule_minute_check" CHECK ("scheduleMinute" BETWEEN 0 AND 1439);
-- All categories/languages remain OFF, including previously approved policy rows.
ALTER TABLE public."SmartNotificationConsent" ADD COLUMN "engagementGranted" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE public."SmartNotificationOpen" (
  "insightId" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
  "viewedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("insightId","userId") REFERENCES public."SmartNotificationInsight"("id","userId") ON DELETE RESTRICT
);
