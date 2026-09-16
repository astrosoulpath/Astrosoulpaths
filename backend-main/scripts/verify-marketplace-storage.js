require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;

const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url) {
  console.error('SUPABASE_URL not configured');
  process.exit(1);
}

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const bucketId = 'marketplace-products';

  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Unable to list buckets: ${listError.message}`);
  }

  const existing = (buckets || []).find(
    (bucket) => bucket.id === bucketId,
  );

  if (!existing) {
    console.log('Bucket missing. Creating production bucket...');

    const { error: createError } =
      await supabase.storage.createBucket(bucketId, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      });

    if (createError) {
      throw new Error(
        `Unable to create bucket: ${createError.message}`,
      );
    }

    console.log('marketplace-products bucket CREATED');
  } else {
    console.log('marketplace-products bucket exists');

    const { error: updateError } =
      await supabase.storage.updateBucket(bucketId, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      });

    if (updateError) {
      throw new Error(
        `Unable to enforce bucket settings: ${updateError.message}`,
      );
    }

    console.log('marketplace-products bucket settings VERIFIED');
  }

  const { data: finalBuckets, error: finalError } =
    await supabase.storage.listBuckets();

  if (finalError) {
    throw finalError;
  }

  const finalBucket = (finalBuckets || []).find(
    (bucket) => bucket.id === bucketId,
  );

  if (!finalBucket) {
    throw new Error('Bucket verification failed');
  }

  console.log('');
  console.log('=== MARKETPLACE STORAGE READY ===');
  console.log(`id: ${finalBucket.id}`);
  console.log(`public: ${finalBucket.public}`);
  console.log(
    `fileSizeLimit: ${finalBucket.file_size_limit ?? 'provider-default'}`,
  );
  console.log(
    `allowedMimeTypes: ${
      finalBucket.allowed_mime_types?.join(', ') ?? 'provider-default'
    }`,
  );
}

main().catch((error) => {
  console.error('');
  console.error('STORAGE CHECK FAILED');
  console.error(error.message);
  process.exit(1);
});
