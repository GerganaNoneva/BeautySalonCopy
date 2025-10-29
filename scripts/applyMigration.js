const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// This requires the SERVICE_ROLE_KEY, not the ANON_KEY
// Service role key bypasses RLS and can execute DDL statements

async function applyMigration() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env file');
    console.log('\nTo apply migrations, you need the Service Role Key:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to Settings > API');
    console.log('4. Copy the "service_role" key (NOT the anon key)');
    console.log('5. Add to .env file: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
    return;
  }

  const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    serviceRoleKey
  );

  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251020000000_fix_appointments_insert_for_unregistered.sql');

  console.log('Reading migration file...');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('\n=== APPLYING MIGRATION ===\n');
  console.log(sql);
  console.log('\n=== EXECUTING ===\n');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      return;
    }

    console.log('✅ Migration applied successfully!');

    // Verify by checking policies
    console.log('\n=== VERIFYING POLICIES ===\n');

    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT schemaname, tablename, policyname, cmd
          FROM pg_policies
          WHERE tablename = 'appointments'
          ORDER BY policyname;
        `
      });

    if (policiesError) {
      console.log('Could not verify policies (this is OK if exec_sql function does not exist)');
    } else {
      console.log('Current policies:', policies);
    }

  } catch (err) {
    console.error('❌ Exception:', err.message);
    console.log('\nThe exec_sql RPC function may not exist.');
    console.log('Please apply the migration manually in Supabase Dashboard SQL Editor.');
  }
}

applyMigration();
