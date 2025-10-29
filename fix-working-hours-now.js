const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wbkkchcgnehauypaysen.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India2tjaGNnbmVoYXV5cGF5c2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxOTgsImV4cCI6MjA3NTgzMTE5OH0.YSnuni42mjApHKV6ZO8p18xC004NPC0SELrh5p-48oo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWorkingHours() {
  console.log('🔧 Fixing working hours...\n');

  try {
    // First, get current working hours
    const { data: current, error: fetchError } = await supabase
      .from('salon_info')
      .select('working_hours_json')
      .maybeSingle();

    if (fetchError) throw fetchError;

    console.log('📋 Current working hours:');
    console.log(JSON.stringify(current?.working_hours_json, null, 2));

    // Update with correct working hours
    const correctHours = {
      monday: { start: "09:00", end: "18:00", closed: false },
      tuesday: { start: "09:00", end: "18:00", closed: false },
      wednesday: { start: "09:00", end: "18:00", closed: false },
      thursday: { start: "09:00", end: "18:00", closed: false },
      friday: { start: "09:00", end: "18:00", closed: false },
      saturday: { start: "10:00", end: "16:00", closed: false },
      sunday: { start: "00:00", end: "00:00", closed: true }
    };

    const { data, error } = await supabase
      .from('salon_info')
      .update({ working_hours_json: correctHours })
      .not('id', 'is', null)
      .select();

    if (error) throw error;

    console.log('\n✅ Working hours fixed successfully!');
    console.log('\n📋 New working hours:');
    console.log(JSON.stringify(correctHours, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

fixWorkingHours();
