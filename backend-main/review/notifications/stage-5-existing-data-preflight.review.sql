-- REVIEW ONLY: run after metadata confirms all seven Smart tables exist.
-- Every violation count must be zero before Stage5 DDL. No row data is printed.
BEGIN READ ONLY;
SELECT 'policy_category' AS invariant,count(*) AS violations FROM public."SmartNotificationPolicy"
 WHERE "category" NOT IN ('love','career','prosperity','marriage','yoga','education','growth','daily','family','cosmic')
UNION ALL SELECT 'policy_languages',count(*) FROM public."SmartNotificationPolicy" p
 WHERE COALESCE(array_ndims("languages"),1)<>1 OR NOT ("languages" <@ ARRAY['en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru']::text[])
 OR cardinality("languages")<>(SELECT count(DISTINCT value) FROM unnest(p."languages") value)
 OR EXISTS(SELECT 1 FROM unnest(p."languages") value WHERE value IS NULL)
UNION ALL SELECT 'revoked_purposes',count(*) FROM public."SmartNotificationConsent" WHERE NOT "granted" AND ("birthUse" OR "engagementGranted")
UNION ALL SELECT 'campaign_versions_or_locale',count(*) FROM public."SmartNotificationCampaign" WHERE "revision"<1 OR "locale" NOT IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru')
UNION ALL SELECT 'campaign_approver',count(*) FROM public."SmartNotificationCampaign" WHERE "state" IN ('APPROVED','SCHEDULED') AND "approvedBy" IS NULL
UNION ALL SELECT 'campaign_schedule',count(*) FROM public."SmartNotificationCampaign" WHERE "state"='SCHEDULED' AND ("scheduledAt" IS NULL OR "scheduledAt">="expiresAt")
UNION ALL SELECT 'insight_versions_or_locale',count(*) FROM public."SmartNotificationInsight" WHERE "consentVersion"<1 OR "policyRevision"<1 OR "locale" NOT IN ('en','hi','bn','ta','te','mr','gu','kn','ml','pa','es','fr','de','pt','it','ja','ko','zh','ar','ru');
COMMIT;
-- Nonzero results are a STOP, not permission to repair or rewrite existing data.
