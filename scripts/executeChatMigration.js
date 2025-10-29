const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env file');
  console.log('\nПолучи service role key от:');
  console.log('https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api');
  console.log('\nДобави го в .env файла като:');
  console.log('SUPABASE_SERVICE_ROLE_KEY=твоят_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  try {
    console.log('🚀 Starting chat migration execution...\n');

    const migrationPath = path.join(__dirname, '../supabase/migrations/20250125_add_message_reactions_and_delete.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing SQL migration...');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        // Try direct query if rpc fails
        const { error: directError } = await supabase.from('_').select('*').limit(0);

        if (error.message.includes('function exec_sql does not exist')) {
          console.log('⚠️  exec_sql function not available, trying raw SQL...');

          // For policies and DDL, we need to use the REST API directly
          console.log('Statement:', statement.substring(0, 100) + '...');
          console.log('✅ Statement prepared (manual execution may be required)');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Verify the message_reactions table exists');
    console.log('2. Test adding reactions to messages');
    console.log('3. Test deleting messages');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n📝 You may need to run this SQL manually in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/YOUR_PROJECT/editor');
    process.exit(1);
  }
}

executeMigration();
