const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRealtimeStatus() {
  console.log('🔍 Checking Realtime status...\n');

  try {
    // Test 1: Check if we can query the tables
    console.log('Test 1: Can we query appointment_requests?');
    const { data: requests, error: requestsError } = await supabase
      .from('appointment_requests')
      .select('id')
      .limit(1);

    if (requestsError) {
      console.log('❌ Error:', requestsError);
    } else {
      console.log('✅ Can query appointment_requests');
    }

    console.log('\nTest 2: Can we query appointments?');
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id')
      .limit(1);

    if (appointmentsError) {
      console.log('❌ Error:', appointmentsError);
    } else {
      console.log('✅ Can query appointments');
    }

    // Test 3: Try to create a subscription
    console.log('\nTest 3: Can we create a Realtime subscription?');
    const channel = supabase
      .channel('test_subscription')
      .on('system', { event: '*' }, (payload) => {
        console.log('📡 System event:', payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointment_requests',
      }, (payload) => {
        console.log('🔴 REAL-TIME EVENT:', payload);
      })
      .subscribe((status, err) => {
        console.log('📊 Subscription status:', status);
        if (err) {
          console.log('❌ Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to appointment_requests');
          console.log('\n🎉 Realtime is working! Now insert a test record to verify events...');
        }
        if (status === 'CHANNEL_ERROR') {
          console.log('❌ Channel error - Realtime is NOT enabled for this table');
          console.log('\n🔧 To fix this:');
          console.log('1. Go to Supabase Dashboard → Database → Replication');
          console.log('2. Find "appointment_requests" and "appointments" tables');
          console.log('3. Toggle ON the switch next to each table');
          console.log('4. OR run this SQL in SQL Editor:');
          console.log('   ALTER PUBLICATION supabase_realtime ADD TABLE appointment_requests;');
          console.log('   ALTER PUBLICATION supabase_realtime ADD TABLE appointments;');
        }
      });

    // Keep the process alive for a few seconds to see subscription status
    setTimeout(() => {
      console.log('\n🛑 Cleaning up and exiting...');
      supabase.removeChannel(channel);
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

checkRealtimeStatus();
