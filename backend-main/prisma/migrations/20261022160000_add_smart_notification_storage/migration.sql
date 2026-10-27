BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
-- Prepared only; application execution requires separate approval.
-- Storage-only: category rows start disabled, unapproved and UNAPPROVED.

-- Source: stage-2-additive.review.sql
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

-- Source: stage-3-policy-controls.review.sql
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

-- Source: stage-5-integrity.review.sql
-- REVIEW ONLY: additive Stage 5 successor. No existing application DB execution.
-- Run once inside the separately approved target-guarded transaction.
-- Preflight must prove existing rows satisfy these checks. Never repair rows implicitly.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';
CREATE FUNCTION public.smart_notification_languages_valid(value text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
 SELECT CASE WHEN array_ndims(value)>1 THEN false ELSE
 value <@ ARRAY['en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru']::text[]
 AND cardinality(value)=(SELECT count(DISTINCT item) FROM unnest(value) AS item)
 AND NOT EXISTS(SELECT 1 FROM unnest(value) AS item WHERE item IS NULL) END;
$$;
ALTER TABLE public."SmartNotificationPolicy"
 ADD CONSTRAINT "SmartPolicy_category_check" CHECK ("category" IN ('love','career','prosperity','marriage','yoga','education','growth','daily','family','cosmic')) NOT VALID,
 ADD CONSTRAINT "SmartPolicy_languages_check" CHECK (public.smart_notification_languages_valid("languages")) NOT VALID,
 ADD CONSTRAINT "SmartPolicy_interval_max_check" CHECK ("minimumIntervalMs"<=2147483647) NOT VALID;
ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_category_check";
ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_languages_check";
ALTER TABLE public."SmartNotificationPolicy" VALIDATE CONSTRAINT "SmartPolicy_interval_max_check";
ALTER TABLE public."SmartNotificationConsent"
 ADD CONSTRAINT "SmartConsent_purpose_check" CHECK ("granted" OR (NOT "birthUse" AND NOT "engagementGranted")) NOT VALID;
ALTER TABLE public."SmartNotificationConsent" VALIDATE CONSTRAINT "SmartConsent_purpose_check";
ALTER TABLE public."SmartNotificationCampaign"
 ADD CONSTRAINT "SmartCampaign_revision_check" CHECK ("revision">0) NOT VALID,
 ADD CONSTRAINT "SmartCampaign_locale_check" CHECK (public.smart_notification_languages_valid(ARRAY["locale"])) NOT VALID,
 ADD CONSTRAINT "SmartCampaign_approval_check" CHECK ("state" NOT IN ('APPROVED','SCHEDULED') OR "approvedBy" IS NOT NULL) NOT VALID,
 ADD CONSTRAINT "SmartCampaign_schedule_check" CHECK ("state"<>'SCHEDULED' OR ("scheduledAt" IS NOT NULL AND "scheduledAt"<"expiresAt")) NOT VALID;
ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_revision_check";
ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_locale_check";
ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_approval_check";
ALTER TABLE public."SmartNotificationCampaign" VALIDATE CONSTRAINT "SmartCampaign_schedule_check";
ALTER TABLE public."SmartNotificationInsight"
 ADD CONSTRAINT "SmartInsight_versions_check" CHECK ("consentVersion">0 AND "policyRevision">0) NOT VALID,
 ADD CONSTRAINT "SmartInsight_locale_check" CHECK (public.smart_notification_languages_valid(ARRAY["locale"])) NOT VALID;
ALTER TABLE public."SmartNotificationInsight" VALIDATE CONSTRAINT "SmartInsight_versions_check";
ALTER TABLE public."SmartNotificationInsight" VALIDATE CONSTRAINT "SmartInsight_locale_check";
CREATE INDEX "SmartNotificationDelivery_due_idx" ON public."SmartNotificationDelivery"("state","nextAttemptAt","createdAt","id");
CREATE INDEX "SmartNotificationAudit_object_action_idx" ON public."SmartNotificationAudit"("objectId","action");
-- Does not seed policies/consent/campaigns, update data, or alter migration history.
-- CHECK/function objects are SQL-managed; verify them beyond Prisma migrate diff.

-- Reviewed category definitions only; no entitlement, consent or release approval.
INSERT INTO public."SmartNotificationPolicy" ("category") VALUES
('love'),
('career'),
('prosperity'),
('marriage'),
('yoga'),
('education'),
('growth'),
('daily'),
('family'),
('cosmic');

COMMIT;
