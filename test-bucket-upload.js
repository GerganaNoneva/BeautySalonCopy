const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBucketUpload() {
  console.log('Testing promotion-images bucket functionality...\n');

  // Create a small test file (1x1 transparent PNG in base64)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const testImageBuffer = Buffer.from(testImageBase64, 'base64');
  const testFileName = `test-${Date.now()}.png`;

  console.log('1. Testing upload to promotion-images bucket...');
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('promotion-images')
    .upload(testFileName, testImageBuffer, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    console.log('❌ Upload failed:', uploadError.message);
    console.log('\nBucket може да не съществува или има проблем с permissions.');
    return;
  }

  console.log('✅ Upload successful!');
  console.log('   File path:', uploadData.path);

  console.log('\n2. Testing public URL generation...');
  const { data: urlData } = supabase.storage
    .from('promotion-images')
    .getPublicUrl(testFileName);

  console.log('✅ Public URL:', urlData.publicUrl);

  console.log('\n3. Testing file deletion...');
  const { error: deleteError } = await supabase.storage
    .from('promotion-images')
    .remove([testFileName]);

  if (deleteError) {
    console.log('❌ Delete failed:', deleteError.message);
  } else {
    console.log('✅ File deleted successfully');
  }

  console.log('\n✅ Promotion-images bucket работи отлично!');
  console.log('Bucket-ът е готов за използване в приложението.');
}

testBucketUpload().catch(error => {
  console.error('Test failed:', error);
});
