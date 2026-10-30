-- REVIEW ONLY. Requires separately authorized restricted role and local pgpass.
-- psql -X -w -h 127.0.0.1 -p 5432 -U <approved_readonly_role> -d astro_soul_path -v ON_ERROR_STOP=1 -f <this-file>
-- No credentials, rows of personal data, tokens or migration logs are selected.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database()='astro_soul_path'
 AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432
 AND current_user NOT IN ('postgres','root')
 AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 AND current_setting('default_transaction_read_only')='on'
 AND NOT has_schema_privilege(current_user,'public','CREATE')
 AND NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND
   (has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
 AND NOT EXISTS(SELECT 1 FROM pg_sequences WHERE schemaname='public' AND has_sequence_privilege(current_user,format('%I.%I',schemaname,sequencename),'USAGE,UPDATE')) AS approved_target \gset
\if :approved_target
SELECT current_database() AS database_name, current_user AS restricted_role, current_setting('server_version') AS version;
SELECT migration_name,checksum,finished_at IS NOT NULL AS applied,rolled_back_at IS NOT NULL AS rolled_back
 FROM public._prisma_migrations ORDER BY started_at,migration_name;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
 AND tablename IN ('PushDevice','SmartNotificationPolicy','SmartNotificationConsent','SmartNotificationCampaign','SmartNotificationInsight','SmartNotificationDelivery','SmartNotificationAudit','SmartNotificationOpen','HoroscopeNotificationOutbox');
SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
 WHERE table_schema='public' AND (table_name LIKE 'SmartNotification%' OR table_name IN ('PushDevice','HoroscopeNotificationOutbox')) ORDER BY table_name,ordinal_position;
SELECT conrelid::regclass AS table_name,conname,convalidated,pg_get_constraintdef(oid) AS definition
 FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid::regclass::text LIKE '%Notification%' ORDER BY 1,2;
ROLLBACK;
\else
ROLLBACK;
\quit 3
\endif
