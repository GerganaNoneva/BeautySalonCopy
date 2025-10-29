const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyPolicy() {
  console.log('Applying DELETE policy for notifications...');

  const { data, error } = await supabase.rpc('query', {
    query: `
      CREATE POLICY IF NOT EXISTS "Users can delete own notifications"
        ON notifications FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id);
    `
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Policy applied successfully!');
  }
}

applyPolicy().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});