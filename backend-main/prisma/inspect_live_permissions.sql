SELECT
  current_user AS current_user,
  current_database() AS database_name;

SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('User', 'LiveSession', 'LiveViewer', 'LiveMessage')
ORDER BY tablename;

SELECT
  has_table_privilege(current_user, '"LiveSession"', 'REFERENCES') AS live_session_references,
  has_table_privilege(current_user, '"User"', 'REFERENCES') AS user_references,
  has_table_privilege(current_user, '"LiveSession"', 'SELECT') AS live_session_select,
  has_table_privilege(current_user, '"User"', 'SELECT') AS user_select;
