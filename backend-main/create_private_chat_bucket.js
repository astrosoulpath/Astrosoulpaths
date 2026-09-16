require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',

  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',

  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  'text/plain',

  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm'
];

async function main() {
  if (!url.trim()) {
    console.error('STOP: SUPABASE_URL missing.');
    process.exitCode = 1;
    return;
  }

  if (!key.trim()) {
    console.error('STOP: SUPABASE_SERVICE_ROLE_KEY missing.');
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: existing, error: existingError } =
    await client.storage.getBucket('chat');

  if (!existingError && existing) {
    console.log('CHAT BUCKET ALREADY EXISTS');
    console.log('public :', existing.public);
    console.log('limit  :', existing.file_size_limit ?? null);
    console.log('mimes  :', existing.allowed_mime_types ?? null);
    return;
  }

  const { data, error } = await client.storage.createBucket('chat', {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes,
  });

  if (error) {
    console.error('CREATE BUCKET ERROR:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log('PRIVATE CHAT BUCKET CREATED');
  console.log('result :', data);

  const { data: verify, error: verifyError } =
    await client.storage.getBucket('chat');

  if (verifyError) {
    console.error('VERIFY ERROR:', verifyError.message);
    process.exitCode = 1;
    return;
  }

  console.log('--- VERIFIED ---');
  console.log('id     :', verify.id);
  console.log('name   :', verify.name);
  console.log('public :', verify.public);
  console.log('limit  :', verify.file_size_limit ?? null);
  console.log('mimes  :', verify.allowed_mime_types ?? null);

  if (verify.public !== false) {
    console.error('STOP: chat bucket is not private.');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      'UNEXPECTED ERROR:',
      error?.message ?? String(error)
    );
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 100);
  });
