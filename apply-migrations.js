const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wbkkchcgnehauypaysen.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India2tjaGNnbmVoYXV5cGF5c2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxOTgsImV4cCI6MjA3NTgzMTE5OH0.YSnuni42mjApHKV6ZO8p18xC004NPC0SELrh5p-48oo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
  console.log('Starting migrations...');

  try {
    // Migration 1: Fix is_admin() function
    console.log('\n1. Creating is_admin() function...');
    const { data: data1, error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION public.is_admin()
        RETURNS boolean
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
          user_role text;
        BEGIN
          SELECT role INTO user_role
          FROM profiles
          WHERE id = auth.uid();

          RETURN COALESCE(user_role = 'admin', false);
        END;
        $$;
      `
    });

    if (error1) {
      console.error('Error creating is_admin() function:', error1);
      throw error1;
    }
    console.log('✓ is_admin() function created successfully');

    // Migration 2: Fix unregistered_clients policies
    console.log('\n2. Dropping old policies...');
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Admins can view all unregistered clients" ON unregistered_clients;',
      'DROP POLICY IF EXISTS "Admins can create unregistered clients" ON unregistered_clients;',
      'DROP POLICY IF EXISTS "Admins can update unregistered clients" ON unregistered_clients;',
      'DROP POLICY IF EXISTS "Admins can delete unregistered clients" ON unregistered_clients;'
    ];

    for (const sql of dropPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error && !error.message.includes('does not exist')) {
        console.error('Error dropping policy:', error);
        throw error;
      }
    }
    console.log('✓ Old policies dropped');

    console.log('\n3. Creating new policies...');
    const createPolicies = [
      {
        name: 'view',
        sql: `
          CREATE POLICY "Admins can view all unregistered clients"
            ON unregistered_clients FOR SELECT
            TO authenticated
            USING (is_admin());
        `
      },
      {
        name: 'insert',
        sql: `
          CREATE POLICY "Admins can create unregistered clients"
            ON unregistered_clients FOR INSERT
            TO authenticated
            WITH CHECK (is_admin());
        `
      },
      {
        name: 'update',
        sql: `
          CREATE POLICY "Admins can update unregistered clients"
            ON unregistered_clients FOR UPDATE
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());
        `
      },
      {
        name: 'delete',
        sql: `
          CREATE POLICY "Admins can delete unregistered clients"
            ON unregistered_clients FOR DELETE
            TO authenticated
            USING (is_admin());
        `
      }
    ];

    for (const policy of createPolicies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      if (error) {
        console.error(`Error creating ${policy.name} policy:`, error);
        throw error;
      }
      console.log(`✓ ${policy.name} policy created`);
    }

    console.log('\n✅ All migrations applied successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

applyMigrations();
