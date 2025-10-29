const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Трябва да използваме service_role key за да заобиколим RLS
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceDeleteAllRequests() {
  try {
    console.log('🗑️ Force deleting all appointment requests...');
    console.log('Using URL:', supabaseUrl);

    // Get all requests first
    const { data: allRequests, error: fetchError } = await supabase
      .from('appointment_requests')
      .select('*');

    if (fetchError) {
      console.error('❌ Error fetching requests:', fetchError);
      return;
    }

    console.log(`📊 Found ${allRequests?.length || 0} requests in database`);

    if (allRequests && allRequests.length > 0) {
      console.log('📋 Requests:');
      allRequests.forEach(r => {
        console.log(`  - ID: ${r.id}, Status: ${r.status}, Client: ${r.client_id}, Hidden: ${r.hidden_by_client}`);
      });

      // Delete all
      const { error: deleteError } = await supabase
        .from('appointment_requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('❌ Error deleting:', deleteError);
        return;
      }

      console.log('✅ All requests deleted!');

      // Verify
      const { data: remaining } = await supabase
        .from('appointment_requests')
        .select('count');

      console.log(`✅ Remaining requests: ${remaining?.length || 0}`);
    } else {
      console.log('✅ Database is already empty');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceDeleteAllRequests();
