require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Need service role key
);

async function fixPolicies() {
  console.log('🔧 Fixing appointment_requests RLS policies...\n');

  const sql = `
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Users can insert their own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can view all appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can update appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can delete appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can insert appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can view own appointment requests" ON appointment_requests;

-- Enable RLS
ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can insert their own appointment requests
CREATE POLICY "Clients can insert appointment requests"
ON appointment_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Policy: Clients can view their own appointment requests
CREATE POLICY "Clients can view own appointment requests"
ON appointment_requests
FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

-- Policy: Admins can view all appointment requests
CREATE POLICY "Admins can view all appointment requests"
ON appointment_requests
FOR SELECT
TO authenticated
USING (is_admin());

-- Policy: Admins can update all appointment requests
CREATE POLICY "Admins can update appointment requests"
ON appointment_requests
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Policy: Admins can delete appointment requests
CREATE POLICY "Admins can delete appointment requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (is_admin());
`;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error:', error);
      console.log('\n⚠️  You need to run this SQL manually in Supabase Dashboard:');
      console.log('Go to: SQL Editor in your Supabase project');
      console.log('Run the following SQL:\n');
      console.log(sql);
    } else {
      console.log('✅ Policies updated successfully!');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n⚠️  You need to run this SQL manually in Supabase Dashboard:');
    console.log('Go to: https://supabase.com/dashboard/project/[your-project-id]/sql/new');
    console.log('Copy and run the following SQL:\n');
    console.log(sql);
  }
}

fixPolicies();
