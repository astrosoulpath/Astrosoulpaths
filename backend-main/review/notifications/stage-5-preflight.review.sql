-- REVIEW ONLY: future separately approved connection. No DDL/DML.
BEGIN READ ONLY;
SELECT current_database() AS database_name, inet_server_addr() AS server_address,
 inet_server_port() AS server_port, current_user AS role_name,
 current_schema() AS schema_name, current_setting('server_version') AS server_version;
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at
 FROM public._prisma_migrations ORDER BY started_at, id;
-- Aggregate only; do not print customer or birth/profile records.
SELECT tablename FROM pg_tables WHERE schemaname='public'
 AND tablename IN ('SmartNotificationPolicy','SmartNotificationConsent','SmartNotificationCampaign','SmartNotificationInsight','SmartNotificationDelivery','SmartNotificationAudit','SmartNotificationOpen') ORDER BY tablename;
SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'SmartNotification%';
SELECT conname,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint
 WHERE conrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace AND relname LIKE 'SmartNotification%');
SELECT event_object_table,trigger_name FROM information_schema.triggers WHERE trigger_schema='public' AND event_object_table LIKE 'SmartNotification%';
COMMIT;
-- STOP if history is unresolved, schema is partially present, or checksums differ.
-- Existing Smart tables need a separately reviewed aggregate data preflight BEFORE
-- Stage5 VALIDATE: locale/category allowlists, NULL/duplicate language entries,
-- revoked purposes, positive versions, approver/schedule invariants. Do not fix rows implicitly.
