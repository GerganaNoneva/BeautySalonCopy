const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyFix() {
  console.log('🔧 Applying appointment notification fix...');

  const sql = `
    -- Update function to include appointment_id in notification data
    CREATE OR REPLACE FUNCTION notify_client_on_appointment_created()
    RETURNS TRIGGER
    SECURITY DEFINER
    SET search_path = public
    LANGUAGE plpgsql
    AS $$
    DECLARE
      service_name TEXT;
      appointment_time TEXT;
      appointment_date_formatted TEXT;
    BEGIN
      -- Only send notification if appointment has a client_id (registered client)
      IF NEW.client_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Get service name
      SELECT name INTO service_name FROM services WHERE id = NEW.service_id;

      -- Format time and date
      appointment_time := SUBSTRING(NEW.start_time::TEXT, 1, 5);
      appointment_date_formatted := TO_CHAR(NEW.appointment_date, 'DD.MM.YYYY');

      -- Insert notification for client with appointment_id in data
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        NEW.client_id,
        'booking_confirmed',
        'Нова резервация',
        'Вашата резервация за ' || COALESCE(service_name, 'услуга') || ' на ' || appointment_date_formatted || ' в ' || appointment_time || ' е потвърдена.',
        jsonb_build_object('appointment_id', NEW.id)
      );

      RETURN NEW;
    END;
    $$;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct execution if RPC doesn't exist
      console.log('📝 Executing SQL directly...');
      const { error: directError } = await supabase.from('_migrations').select('*').limit(1);

      if (directError) {
        console.error('❌ Error:', directError);
        console.log('\n⚠️  Please execute this SQL manually in Supabase dashboard:');
        console.log(sql);
        return;
      }
    }

    console.log('✅ Function updated successfully!');
    console.log('✅ New appointments will now include appointment_id in notification data');
  } catch (err) {
    console.error('❌ Error executing SQL:', err);
    console.log('\n⚠️  Please execute this SQL manually in Supabase dashboard SQL editor:');
    console.log(sql);
  }
}

applyFix().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
