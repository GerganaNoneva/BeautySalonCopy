const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wbkkchcgnehauypaysen.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India2tjaGNnbmVoYXV5cGF5c2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxOTgsImV4cCI6MjA3NTgzMTE5OH0.YSnuni42mjApHKV6ZO8p18xC004NPC0SELrh5p-48oo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
  console.log('🔍 Checking database...\n');

  const { data, error } = await supabase
    .from('salon_info')
    .select('working_hours_json')
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 working_hours_json from database:');
  console.log(JSON.stringify(data?.working_hours_json, null, 2));

  console.log('\n🔬 Detailed analysis:');
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  days.forEach(day => {
    const hours = data?.working_hours_json?.[day];
    console.log(`\n${day}:`);
    console.log(`  - closed: ${hours?.closed} (type: ${typeof hours?.closed})`);
    console.log(`  - start: ${hours?.start}`);
    console.log(`  - end: ${hours?.end}`);
    console.log(`  - Will be treated as CLOSED: ${!hours || hours.closed}`);
  });
}

checkDB();
