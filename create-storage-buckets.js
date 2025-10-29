const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStorageBuckets() {
  console.log('Creating Storage buckets in new database...\n');

  // Create promotion-images bucket
  console.log('Creating promotion-images bucket...');
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('promotion-images', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  });

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('✅ promotion-images bucket already exists');
    } else {
      console.error('❌ Error creating promotion-images bucket:', bucketError);
      return;
    }
  } else {
    console.log('✅ promotion-images bucket created successfully');
  }

  // The policies should already be created by the migration
  // Let's verify the storage buckets now
  console.log('\nVerifying storage buckets...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    return;
  }

  console.log(`\n✅ Found ${buckets.length} storage bucket(s):`);
  buckets.forEach(b => {
    console.log(`   - ${b.name} (public: ${b.public})`);
  });

  console.log('\n✅ Storage setup complete!');
  console.log('\nNote: Gallery photos are stored as base64 in the database (gallery_photos.image_url),');
  console.log('not in Storage buckets, so no gallery bucket is needed.');
}

createStorageBuckets().catch(console.error);
