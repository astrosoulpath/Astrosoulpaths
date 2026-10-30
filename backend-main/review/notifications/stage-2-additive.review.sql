-- REVIEW ONLY. No application database execution authorized.
-- Apply once in a separately approved transaction after backup/schema preflight.
CREATE TABLE public."SmartNotificationPolicy" (
  "category" TEXT PRIMARY KEY,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "entitlement" TEXT NOT NULL DEFAULT 'UNAPPROVED' CHECK ("entitlement" IN ('UNAPPROVED','FREE_APPROVED')),
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision">0),
  "dailyLimit" INTEGER NOT NULL DEFAULT 1 CHECK ("dailyLimit" BETWEEN 1 AND 10),
  "minimumIntervalMs" INTEGER NOT NULL DEFAULT 86400000 CHECK ("minimumIntervalMs">=3600000),
  "quietStart" INTEGER NOT NULL DEFAULT 1320 CHECK ("quietStart" BETWEEN 0 AND 1439),
  "quietEnd" INTEGER NOT NULL DEFAULT 480 CHECK ("quietEnd" BETWEEN 0 AND 1439),
  CHECK ("quietStart"<>"quietEnd")
);
CREATE TABLE public."SmartNotificationConsent" (
  "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "category" TEXT NOT NULL REFERENCES public."SmartNotificationPolicy"("category") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version">0),
  "granted" BOOLEAN NOT NULL DEFAULT false,
  "birthUse" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "timezone" TEXT NOT NULL,
  PRIMARY KEY ("userId","category")
);
CREATE TABLE public."SmartNotificationCampaign" (
  "id" TEXT PRIMARY KEY,
  "category" TEXT NOT NULL REFERENCES public."SmartNotificationPolicy"("category") ON DELETE RESTRICT,
  "locale" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "provenance" TEXT NOT NULL DEFAULT 'ADMIN_EDITORIAL' CHECK ("provenance"='ADMIN_EDITORIAL'),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "state" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("state" IN ('DRAFT','APPROVED','SCHEDULED','PAUSED')),
  "createdBy" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "approvedBy" TEXT REFERENCES public."User"("id") ON DELETE RESTRICT,
  "scheduledAt" TIMESTAMPTZ, "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length("title") BETWEEN 1 AND 120 AND length("body") BETWEEN 1 AND 3000)
);
CREATE TABLE public."SmartNotificationInsight" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "category" TEXT NOT NULL REFERENCES public."SmartNotificationPolicy"("category") ON DELETE RESTRICT,
  "locale" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "provenance" TEXT NOT NULL CHECK ("provenance" IN ('ADMIN_EDITORIAL','LOCAL_COMPUTED')),
  "factors" JSONB NOT NULL DEFAULT '[]', "sourceVersion" TEXT NOT NULL,
  "generationKey" TEXT UNIQUE,
  "consentVersion" INTEGER NOT NULL, "policyRevision" INTEGER NOT NULL,
  "campaignId" TEXT REFERENCES public."SmartNotificationCampaign"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMPTZ NOT NULL,
  UNIQUE ("userId","campaignId"), UNIQUE ("id","userId")
);
CREATE INDEX "SmartNotificationInsight_owner_idx" ON public."SmartNotificationInsight"("userId","createdAt");
CREATE TABLE public."SmartNotificationDelivery" (
  "id" TEXT PRIMARY KEY, "insightId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("state" IN ('QUEUED','PROCESSING','SENDING','ACCEPTED','CANCELLED','UNKNOWN','FAILED')),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "leaseToken" TEXT, "leaseUntil" TIMESTAMPTZ, "resultCode" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attemptedAt" TIMESTAMPTZ,
  FOREIGN KEY ("insightId","userId") REFERENCES public."SmartNotificationInsight"("id","userId") ON DELETE RESTRICT,
  UNIQUE ("insightId")
);
CREATE INDEX "SmartNotificationDelivery_claim_idx" ON public."SmartNotificationDelivery"("state","createdAt");
CREATE INDEX "SmartNotificationDelivery_frequency_idx" ON public."SmartNotificationDelivery"("userId","attemptedAt");
CREATE TABLE public."SmartNotificationAudit" (
  "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE RESTRICT,
  "objectId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE FUNCTION public.smart_notification_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Smart notification record is immutable'; END $$;
CREATE TRIGGER "SmartNotificationAudit_immutable" BEFORE UPDATE OR DELETE ON public."SmartNotificationAudit"
FOR EACH ROW EXECUTE FUNCTION public.smart_notification_immutable();
CREATE TRIGGER "SmartNotificationInsight_immutable" BEFORE UPDATE OR DELETE ON public."SmartNotificationInsight"
FOR EACH ROW EXECUTE FUNCTION public.smart_notification_immutable();
-- No policies, consent, campaigns or application rows are seeded by this DDL.
