const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function initWorkingHours() {
  console.log('🔧 Initializing working hours...\n');

  // Default working hours: Monday-Saturday 9:00-17:30, Sunday closed
  const workingHours = {
    monday: { start: '09:00', end: '17:30', closed: false },
    tuesday: { start: '09:00', end: '17:30', closed: false },
    wednesday: { start: '09:00', end: '17:30', closed: false },
    thursday: { start: '09:00', end: '17:30', closed: false },
    friday: { start: '09:00', end: '17:30', closed: false },
    saturday: { start: '09:00', end: '17:30', closed: false },
    sunday: { start: '09:00', end: '17:30', closed: true }
  };

  // Check if record exists
  const { data: existing } = await supabase
    .from('salon_info')
    .select('id')
    .maybeSingle();

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from('salon_info')
      .update({ working_hours_json: workingHours })
      .eq('id', existing.id);

    if (error) {
      console.error('❌ Error updating:', error);
      return;
    }

    console.log('✅ Working hours updated successfully!');
  } else {
    // Insert new record
    const { error } = await supabase
      .from('salon_info')
      .insert({
        salon_name: 'Beauty Salon',
        phone: '',
        address: '',
        working_hours_json: workingHours
      });

    if (error) {
      console.error('❌ Error inserting:', error);
      return;
    }

    console.log('✅ Working hours created successfully!');
  }

  console.log('\n📅 Working hours configuration:');
  console.log(JSON.stringify(workingHours, null, 2));
}

initWorkingHours();
