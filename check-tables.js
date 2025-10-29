const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking tables in new database...\n');

  // Query to get all tables in public schema
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (error) {
    // Try alternative method using RPC
    console.log('Using alternative method to check tables...\n');

    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

    if (rpcError) {
      console.error('Error fetching tables:', rpcError);

      // Try one more method - just list some known tables
      console.log('\nChecking known tables individually:\n');
      const knownTables = [
        'profiles',
        'appointments',
        'services',
        'messages',
        'conversations',
        'notifications',
        'gallery_photos',
        'gallery_likes',
        'gallery_comments',
        'photo_reactions',
        'chat_messages',
        'salon_info',
        'appointment_requests',
        'promotions',
        'clients',
        'unregistered_clients',
        'working_hours',
        'phone_verification_codes'
      ];

      let count = 0;
      for (const table of knownTables) {
        const { data: check, error: checkError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (!checkError) {
          console.log(`✅ ${table} - EXISTS`);
          count++;
        } else {
          console.log(`❌ ${table} - NOT FOUND`);
        }
      }

      console.log(`\nTotal tables found: ${count}/${knownTables.length}`);
      return;
    }

    console.log('Tables found:', rpcData);
  } else {
    console.log(`Found ${data.length} tables:\n`);
    data.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });
  }
}

checkTables().catch(console.error);
