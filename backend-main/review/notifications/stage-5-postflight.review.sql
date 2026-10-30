-- REVIEW ONLY: read-only postflight after separately approved execution.
BEGIN READ ONLY;
SELECT current_database(),inet_server_addr(),inet_server_port(),current_user,current_schema();
SELECT conname,convalidated FROM pg_constraint WHERE conname IN
 ('SmartPolicy_category_check','SmartPolicy_languages_check','SmartPolicy_interval_max_check',
 'SmartConsent_purpose_check','SmartCampaign_revision_check','SmartCampaign_locale_check',
 'SmartCampaign_approval_check','SmartCampaign_schedule_check','SmartInsight_versions_check','SmartInsight_locale_check') ORDER BY conname;
SELECT indexname,indexdef FROM pg_indexes WHERE indexname IN ('SmartNotificationDelivery_due_idx','SmartNotificationAudit_object_action_idx');
SELECT 'empty' AS input,public.smart_notification_languages_valid(ARRAY[]::text[]) AS expected_true
 UNION ALL SELECT 'duplicate',public.smart_notification_languages_valid(ARRAY['en','en'])
 UNION ALL SELECT 'unknown',public.smart_notification_languages_valid(ARRAY['xx']);
SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY started_at,id;
COMMIT;
-- Compare independent before/after aggregate row fingerprints, OIDs, constraints,
-- ownership/privileges, and history against the approved package. Do not expose row data.
