-- REVIEW ONLY: requires separate operator approval. Not a Prisma migration.
-- No additional GRANT is necessary: astro_user already has required DML.
-- Narrows only the five new reminder tables; no business records changed.
-- No runtime deletion path exists; approve retention/purge under a separate role.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $$
BEGIN
 IF current_database() <> 'astro_soul_path'
 OR inet_server_addr() IS DISTINCT FROM inet '127.0.0.1'
 OR inet_server_port() <> 5432 OR current_user <> 'postgres' THEN
  RAISE EXCEPTION 'LOCAL_OPERATOR_TARGET_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='astro_user'
   AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole) THEN
  RAISE EXCEPTION 'RUNTIME_ROLE_DRIFT';
 END IF;
 IF (SELECT pg_has_role('astro_user',relowner,'USAGE') FROM pg_class
   WHERE oid='public."HoroscopeSubscriptionAudit"'::regclass) THEN
  RAISE EXCEPTION 'RUNTIME_OWNER_PRIVILEGES';
 END IF;
END $$;
REVOKE UPDATE, DELETE ON TABLE public."HoroscopeSubscriptionAudit" FROM astro_user;
REVOKE DELETE ON TABLE public."PersonalizedHoroscopeReading", public."HoroscopeNotificationPreference",
 public."HoroscopeNotificationOutbox", public."HoroscopeSubscriptionControl" FROM astro_user;
DO $$
DECLARE relation_name text;
BEGIN
 IF has_table_privilege('astro_user','public."HoroscopeSubscriptionAudit"','UPDATE')
 OR has_table_privilege('astro_user','public."HoroscopeSubscriptionAudit"','DELETE')
 OR has_table_privilege('astro_user','public."HoroscopeSubscriptionAudit"','TRUNCATE')
 OR NOT has_table_privilege('astro_user','public."HoroscopeSubscriptionAudit"','SELECT')
 OR NOT has_table_privilege('astro_user','public."HoroscopeSubscriptionAudit"','INSERT') THEN
  RAISE EXCEPTION 'AUDIT_EFFECTIVE_PRIVILEGE_POSTFLIGHT_FAILED';
 END IF;
 FOREACH relation_name IN ARRAY ARRAY['PersonalizedHoroscopeReading','HoroscopeNotificationPreference','HoroscopeNotificationOutbox','HoroscopeSubscriptionControl'] LOOP
  IF has_table_privilege('astro_user',format('public.%I',relation_name),'DELETE')
  OR NOT has_table_privilege('astro_user',format('public.%I',relation_name),'SELECT')
  OR NOT has_table_privilege('astro_user',format('public.%I',relation_name),'INSERT')
  OR NOT has_table_privilege('astro_user',format('public.%I',relation_name),'UPDATE') THEN
   RAISE EXCEPTION 'REMINDER_EFFECTIVE_PRIVILEGE_POSTFLIGHT_FAILED';
  END IF;
 END LOOP;
END $$;
COMMIT;
-- Recovery: restore prior audited ACL only under separate approval, never delete audit rows.
