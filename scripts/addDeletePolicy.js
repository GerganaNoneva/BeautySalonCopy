const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.log('   Add it to your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addDeletePolicy() {
  console.log('🔧 Adding DELETE policies for appointments...\n');

  const sql = `
    -- Enable DELETE for clients on their own appointments
    DROP POLICY IF EXISTS "clients_can_delete_own_appointments" ON appointments;

    CREATE POLICY "clients_can_delete_own_appointments"
    ON appointments FOR DELETE
    TO authenticated
    USING (client_id = auth.uid());

    -- Also allow admins to delete any appointment
    DROP POLICY IF EXISTS "admins_can_delete_any_appointment" ON appointments;

    CREATE POLICY "admins_can_delete_any_appointment"
    ON appointments FOR DELETE
    TO authenticated
    USING (is_admin());
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Run this SQL manually in Supabase Dashboard:\n');
    console.log(sql);
  } else {
    console.log('✅ DELETE policies added successfully!');
    console.log('   - Clients can delete their own appointments');
    console.log('   - Admins can delete any appointment');
  }
}

addDeletePolicy();
