const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function deleteAllRequests() {
  try {
    console.log('🗑️ Deleting all appointment requests...');

    // First, let's see how many requests we have
    const { data: existingRequests, error: countError } = await supabase
      .from('appointment_requests')
      .select('id, status, client_id');

    if (countError) {
      console.error('❌ Error fetching requests:', countError);
      return;
    }

    console.log(`📊 Found ${existingRequests?.length || 0} requests to delete`);

    if (existingRequests && existingRequests.length > 0) {
      console.log('📋 Requests:', existingRequests.map(r => `ID: ${r.id}, Status: ${r.status}`));

      // Delete all requests
      const { data: deletedData, error: deleteError } = await supabase
        .from('appointment_requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (dummy condition that's always true)
        .select();

      if (deleteError) {
        console.error('❌ Error deleting requests:', deleteError);
        return;
      }

      console.log(`✅ Successfully deleted ${deletedData?.length || 0} requests`);
    } else {
      console.log('✅ No requests to delete');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteAllRequests();
