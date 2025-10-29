const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function applyPolicy() {
  try {
    console.log('\n=== APPLYING CLIENT NOTIFY POLICY ===\n');

    // First, let's check existing policies
    console.log('Checking existing INSERT policies on notifications...\n');

    // Try to create the policy using a direct SQL execution
    const sql = `
-- Allow clients to insert notifications for admins
CREATE POLICY IF NOT EXISTS "Clients can notify admins"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a client
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
    AND
    -- Can only send notifications to admins
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = notifications.user_id
      AND profiles.role = 'admin'
    )
  );
`;

    console.log('Executing SQL:\n', sql);

    // Execute using supabase CLI
    const { execSync } = require('child_process');
    const fs = require('fs');

    // Write SQL to temp file
    const tempFile = 'temp_policy.sql';
    fs.writeFileSync(tempFile, sql);

    try {
      const result = execSync(`npx supabase db execute --file ${tempFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log('✅ Policy applied successfully!');
      console.log(result);
    } catch (error) {
      console.error('❌ Error applying policy:', error.message);
      if (error.stdout) console.log('stdout:', error.stdout);
      if (error.stderr) console.log('stderr:', error.stderr);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }

  } catch (err) {
    console.error('Exception:', err);
  }
}

applyPolicy();
