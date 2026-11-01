-- Proposed later operator-only check as the restricted role, not the owner.
-- Does not prove resource identity alone: pair with owner identity evidence and
-- verified Singapore hostname/configuration. No migration-history access needed.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT json_build_object(
 'databaseMatches',current_database()='astro_soul_path',
 'authenticatedRuntimeRole',session_user='asp_sg_runtime_v1' AND current_user=session_user,
 'postgres18',current_setting('server_version_num')::int BETWEEN 180000 AND 189999,
 'readOnly',current_setting('transaction_read_only')='on',
 'ssl',coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false),
 'noElevatedAttributes',NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolinherit),
 'loginEnabled',r.rolcanlogin,
 'connectionLimitMatches',r.rolconnlimit=20,
 'noOutgoingMembership',NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid),
 'noOwnership',NOT EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=r.oid AND deptype='o'),
 'databaseCreateDenied',NOT has_database_privilege(r.oid,current_database(),'CREATE'),
 'schemaCreateDenied',NOT has_schema_privilege(r.oid,'public','CREATE'),
 'connectAllowed',has_database_privilege(r.oid,current_database(),'CONNECT'),
 'publicUsageAllowed',has_schema_privilege(r.oid,'public','USAGE'),
 'inheritedTempException',has_database_privilege(r.oid,current_database(),'TEMP'),
 'userReadAllowed',has_table_privilege(r.oid,'public."User"','SELECT'),
 'migrationHistoryReadDenied',NOT has_table_privilege(r.oid,'public."_prisma_migrations"','SELECT')
) FROM pg_roles r WHERE rolname=current_user;
ROLLBACK;
