-- REVIEW ONLY. Read-only audit; no schema or history mutation.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT current_database()='astro_soul_path' AS approved_database,inet_server_addr()=inet '127.0.0.1' AS approved_host,
inet_server_port()=5432 AS approved_port,current_setting('transaction_read_only')='on' AS enforced_read_only;
-- STOP unless every identity/read-only value above is true.
WITH expected(table_name,column_name,type,not_null,default_expression) AS (VALUES
('AiAstroFollow','id','text',true,NULL),
('AiAstroFollow','followerId','text',true,NULL),
('AiAstroFollow','personaId','text',true,NULL),
('AiAstroFollow','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'),
('LiveMessage','id','text',true,NULL),
('LiveMessage','liveSessionId','text',true,NULL),
('LiveMessage','userId','text',true,NULL),
('LiveMessage','message','text',true,NULL),
('LiveMessage','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'),
('ai_astro_personas','id','text',true,NULL),
('ai_astro_personas','code','text',true,NULL),
('ai_astro_personas','name','text',true,NULL),
('ai_astro_personas','subtitle','text',true,NULL),
('ai_astro_personas','description','text',true,NULL),
('ai_astro_personas','avatarUrl','text',false,NULL),
('ai_astro_personas','initials','text',false,NULL),
('ai_astro_personas','categories','text[]',false,NULL),
('ai_astro_personas','languages','text[]',false,'ARRAY[''English''::text, ''Hindi''::text]'),
('ai_astro_personas','expertise','text[]',false,'ARRAY[]::text[]'),
('ai_astro_personas','rating','double precision',true,'5'),
('ai_astro_personas','totalReviews','integer',true,'0'),
('ai_astro_personas','experience','integer',true,'0'),
('ai_astro_personas','isEnabled','boolean',true,'true'),
('ai_astro_personas','sortOrder','integer',true,'0'),
('ai_astro_personas','pricingMode','text',true,'''PER_MINUTE''::text'),
('ai_astro_personas','isFree','boolean',true,'false'),
('ai_astro_personas','pricePerMinute','numeric(12,2)',false,NULL),
('ai_astro_personas','currency','text',true,'''INR''::text'),
('ai_astro_personas','createdAt','timestamp(3) without time zone',true,'CURRENT_TIMESTAMP'),
('ai_astro_personas','updatedAt','timestamp(3) without time zone',true,NULL)
), actual AS (
SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS type,
a.attnotnull AS not_null,pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relname IN ('ai_astro_personas','AiAstroFollow','LiveMessage'))
SELECT coalesce(e.table_name,a.table_name) AS table_name,coalesce(e.column_name,a.column_name) AS column_name,
 e.type AS expected_type,a.type AS actual_type,e.not_null AS expected_not_null,a.not_null AS actual_not_null,
e.default_expression AS expected_default,a.default_expression AS actual_default
FROM expected e FULL JOIN actual a USING(table_name,column_name)
WHERE e.type IS DISTINCT FROM a.type OR e.not_null IS DISTINCT FROM a.not_null OR e.default_expression IS DISTINCT FROM a.default_expression;
-- PASS requires zero mismatch rows above.
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('ai_astro_personas','AiAstroFollow','LiveMessage') ORDER BY tablename,indexname;
SELECT c.relname,co.conname,co.convalidated,pg_get_constraintdef(co.oid) FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('ai_astro_personas','AiAstroFollow','LiveMessage') AND co.contype IN ('p','u','f','c') ORDER BY c.relname,co.conname;
-- Option A must preserve existing indexes/FKs and array nullability/defaults.
-- Compare definitions to schema-audit.json, not just object names.
-- Compare migration-history names/checksums to the separately approved plan.
-- For a later LiveConnection migration run ../live-v2-postflight.review.sql too.
ROLLBACK;
