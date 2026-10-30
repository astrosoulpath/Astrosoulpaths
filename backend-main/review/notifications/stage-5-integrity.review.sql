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
