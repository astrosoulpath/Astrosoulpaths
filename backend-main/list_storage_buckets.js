require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function main() {
  if (!url.trim()) {
    console.error('STOP: SUPABASE_URL missing.');
    return;
  }

  if (!key.trim()) {
    console.error('STOP: SUPABASE_SERVICE_ROLE_KEY missing.');
    return;
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.storage.listBuckets();

  if (error) {
    console.error('LIST BUCKETS ERROR:', error.message);
    return;
  }

  console.log('TOTAL BUCKETS:', data?.length ?? 0);

  for (const bucket of data ?? []) {
    console.log('--------------------------------');
    console.log('id     :', bucket.id);
    console.log('name   :', bucket.name);
    console.log('public :', bucket.public);
    console.log('limit  :', bucket.file_size_limit ?? null);
    console.log('mimes  :', bucket.allowed_mime_types ?? null);
  }
}

main()
  .catch((error) => {
    console.error('UNEXPECTED ERROR:', error?.message ?? String(error));
  })
  .finally(() => {
    setTimeout(() => process.exit(0), 100);
  });
