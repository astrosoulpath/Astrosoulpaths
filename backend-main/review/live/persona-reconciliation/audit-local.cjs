// Read-only, hard-gated local metadata audit. Never instantiate application services.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../../..');

function validateLocalUrls(values) {
  for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
    const url = new URL(values[name]);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
        (url.port || '5432') !== '5432' || decodeURIComponent(url.pathname) !== '/astro_soul_path') {
      throw new Error('Local target validation failed');
    }
    for (const key of url.searchParams.keys()) {
      if (!['schema', 'connection_limit', 'pool_timeout'].includes(key) ||
          (key === 'schema' && url.searchParams.get(key) !== 'public')) {
        throw new Error('Unsupported local connection option');
      }
    }
  }
  return new URL(values.DATABASE_URL);
}

function compareSchema(actual, expected) {
  return ['columns', 'indexes', 'constraints'].filter(key =>
    JSON.stringify(actual[key]) !== JSON.stringify(expected[key]));
}

async function audit() {
  const file = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
  const url = validateLocalUrls({ DATABASE_URL: process.env.DATABASE_URL || file.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL || file.DIRECT_URL });
  const client = new Client({
    // Explicit fields prevent URL query parameters or PGHOST from redirecting
    // the connection after endpoint validation. Never forward URL options.
    host: '127.0.0.1', port: 5432, database: 'astro_soul_path',
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: false,
    connectionTimeoutMillis: 5000,
    options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=2000',
  });
  let begun = false;
  let result;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    begun = true;
    const identity = (await client.query(`SELECT current_database()='astro_soul_path' AS database_ok,
      inet_server_addr()=inet '127.0.0.1' AS host_ok,inet_server_port()=5432 AS port_ok,
      current_setting('transaction_read_only')='on' AS read_only`)).rows[0];
    if (['database_ok', 'host_ok', 'port_ok', 'read_only'].some(key => identity[key] !== true)) throw new Error('Identity verification failed');
    const tables = ['ai_astro_personas', 'AiAstroFollow', 'LiveMessage'];
    const columns = (await client.query(`SELECT c.relname AS table_name,a.attname AS column_name,
      format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,
      pg_get_expr(d.adbin,d.adrelid) AS default_expression
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname,a.attnum`, [tables])).rows;
    const indexes = (await client.query(`SELECT tablename,indexname,indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,indexname`, [tables])).rows;
    const constraints = (await client.query(`SELECT c.relname AS table_name,co.conname,
      co.convalidated,pg_get_constraintdef(co.oid) AS definition
      FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
      AND (c.relname=ANY($1) OR co.confrelid='public.ai_astro_personas'::regclass)
      AND co.contype IN ('p','u','f','c') ORDER BY c.relname,co.conname`, [tables])).rows;
    const counts = (await client.query(`SELECT count(*)::int AS total_rows,
      count(*) FILTER(WHERE categories IS NULL)::int AS categories_null,
      count(*) FILTER(WHERE cardinality(categories)=0)::int AS categories_empty,
      count(*) FILTER(WHERE languages IS NULL)::int AS languages_null,
      count(*) FILTER(WHERE cardinality(languages)=0)::int AS languages_empty,
      count(*) FILTER(WHERE expertise IS NULL)::int AS expertise_null,
      count(*) FILTER(WHERE cardinality(expertise)=0)::int AS expertise_empty
      FROM public.ai_astro_personas`)).rows[0];
    result = { observedAt: new Date().toISOString(), identity, columns, indexes, constraints, counts };
  } finally {
    try { if (begun) await client.query('ROLLBACK'); }
    finally { await client.end(); }
  }
  // Optional artifact contains only schema metadata and aggregate counts.
  if (process.argv.includes('--write-review')) {
    fs.writeFileSync(path.join(__dirname, 'schema-audit.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  const snapshot = path.join(__dirname, 'schema-audit.json');
  const differences = fs.existsSync(snapshot) ? compareSchema(result, JSON.parse(fs.readFileSync(snapshot, 'utf8'))) : ['snapshot missing'];
  console.log(JSON.stringify({ identity: result.identity, counts: result.counts,
    exactSchemaComparison: differences.length ? 'FAIL' : 'PASS', differentSections: differences,
    rollbackAndDisconnect: 'PASS' }));
  if (differences.length) process.exitCode = 1;
}
module.exports = { validateLocalUrls, compareSchema };
if (require.main === module) audit().catch(() => {
  // Never print pg/dotenv errors: they can contain connection identifiers.
  console.error('Local read-only audit failed safely; no sensitive error details printed.');
  process.exitCode = 1;
});
