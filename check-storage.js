const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('Checking Storage buckets in new database...\n');

  // List all storage buckets
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.error('Error fetching buckets:', error);
    return;
  }

  console.log(`Found ${buckets.length} storage buckets:\n`);

  for (const bucket of buckets) {
    console.log(`\n📦 Bucket: ${bucket.name}`);
    console.log(`   Public: ${bucket.public}`);
    console.log(`   Created: ${new Date(bucket.created_at).toLocaleString()}`);

    // Try to list files in this bucket
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket.name)
      .list('', {
        limit: 5,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (filesError) {
      console.log(`   ❌ Error listing files: ${filesError.message}`);
    } else {
      console.log(`   Files: ${files.length} (showing first 5)`);
      if (files.length > 0) {
        files.forEach(file => {
          console.log(`      - ${file.name} (${(file.metadata?.size / 1024).toFixed(2)} KB)`);
        });
      } else {
        console.log(`      (bucket is empty)`);
      }
    }
  }

  console.log('\n\nExpected buckets:');
  console.log('  - gallery (for gallery photos)');
  console.log('  - promotion-images (for promotion images)');
  console.log('  - avatars (if used for profile pictures)');
}

checkStorage().catch(console.error);
