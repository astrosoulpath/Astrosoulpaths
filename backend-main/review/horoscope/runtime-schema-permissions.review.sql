-- REVIEW ONLY; separately approve this schema-wide capability reduction.
-- No runtime CREATE TABLE/SCHEMA/FUNCTION/INDEX/ALTER TABLE found in src production code.
-- Review startup tooling and external consumers before applying. No role is granted ownership.
BEGIN;
DO $$
BEGIN
 IF current_database() <> 'astro_soul_path'
 OR inet_server_addr() IS DISTINCT FROM inet '127.0.0.1'
 OR inet_server_port() <> 5432 OR current_user <> 'postgres' THEN
  RAISE EXCEPTION 'LOCAL_OPERATOR_TARGET_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='astro_user' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) THEN
  RAISE EXCEPTION 'RUNTIME_ROLE_DRIFT';
 END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM astro_user;
DO $$
BEGIN
 IF has_schema_privilege('astro_user','public','CREATE')
 OR NOT has_schema_privilege('astro_user','public','USAGE') THEN
  RAISE EXCEPTION 'SCHEMA_EFFECTIVE_PRIVILEGE_POSTFLIGHT_FAILED';
 END IF;
END $$;
COMMIT;
-- Does not revoke privileges from PUBLIC, owners or other roles; stop on inherited grants.
-- Recovery requires a separately approved restoration of the prior schema ACL.
