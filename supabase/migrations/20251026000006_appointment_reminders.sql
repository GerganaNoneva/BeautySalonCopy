-- Create function to send appointment reminders
CREATE OR REPLACE FUNCTION send_appointment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_record RECORD;
  appointment_datetime TIMESTAMP;
  time_until_appointment INTERVAL;
  service_name TEXT;
  promotion_name TEXT;
  client_name TEXT;
BEGIN
  -- Loop through all confirmed appointments
  FOR appointment_record IN
    SELECT
      a.id,
      a.client_id,
      a.unregistered_client_id,
      a.appointment_date,
      a.start_time,
      a.service_id,
      a.promotion_id,
      s.name as service_name,
      pr.name as promotion_name,
      p.full_name as client_name,
      uc.full_name as unregistered_client_name
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN promotions pr ON a.promotion_id = pr.id
    LEFT JOIN profiles p ON a.client_id = p.id
    LEFT JOIN unregistered_clients uc ON a.unregistered_client_id = uc.id
    WHERE a.status = 'confirmed'
      AND a.appointment_date >= CURRENT_DATE
  LOOP
    -- Combine date and time
    appointment_datetime := appointment_record.appointment_date + appointment_record.start_time;

    -- Calculate time until appointment
    time_until_appointment := appointment_datetime - NOW();

    -- Get service or promotion name
    IF appointment_record.service_name IS NOT NULL THEN
      service_name := appointment_record.service_name;
    ELSIF appointment_record.promotion_name IS NOT NULL THEN
      service_name := appointment_record.promotion_name;
    ELSE
      service_name := 'Услуга';
    END IF;

    -- Get client name
    IF appointment_record.client_name IS NOT NULL THEN
      client_name := appointment_record.client_name;
    ELSE
      client_name := appointment_record.unregistered_client_name;
    END IF;

    -- Check for 24 hour reminder (between 23h 45m and 24h 15m)
    IF time_until_appointment >= INTERVAL '23 hours 45 minutes'
       AND time_until_appointment <= INTERVAL '24 hours 15 minutes' THEN

      -- Check if we already sent this notification
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = appointment_record.client_id
          AND type = 'appointment_reminder_24h'
          AND (data->>'appointment_id')::uuid = appointment_record.id
      ) AND appointment_record.client_id IS NOT NULL THEN

        -- Create 24h reminder notification
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          appointment_record.client_id,
          'appointment_reminder_24h',
          'Напомняне за резервация',
          'Имате резервация утре в ' || TO_CHAR(appointment_datetime, 'HH24:MI') || ' за ' || service_name,
          jsonb_build_object(
            'appointment_id', appointment_record.id,
            'appointment_date', appointment_record.appointment_date,
            'start_time', appointment_record.start_time
          )
        );

        RAISE NOTICE '24h reminder sent for appointment % to client %', appointment_record.id, client_name;
      END IF;
    END IF;

    -- Check for 1 hour reminder (between 45m and 1h 15m)
    IF time_until_appointment >= INTERVAL '45 minutes'
       AND time_until_appointment <= INTERVAL '1 hour 15 minutes' THEN

      -- Check if we already sent this notification
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = appointment_record.client_id
          AND type = 'appointment_reminder_1h'
          AND (data->>'appointment_id')::uuid = appointment_record.id
      ) AND appointment_record.client_id IS NOT NULL THEN

        -- Create 1h reminder notification
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          appointment_record.client_id,
          'appointment_reminder_1h',
          'Напомняне за резервация',
          'Имате резервация след 1 час в ' || TO_CHAR(appointment_datetime, 'HH24:MI') || ' за ' || service_name,
          jsonb_build_object(
            'appointment_id', appointment_record.id,
            'appointment_date', appointment_record.appointment_date,
            'start_time', appointment_record.start_time
          )
        );

        RAISE NOTICE '1h reminder sent for appointment % to client %', appointment_record.id, client_name;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every 15 minutes
SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',  -- Every 15 minutes
  'SELECT send_appointment_reminders();'
);

-- Add comment
COMMENT ON FUNCTION send_appointment_reminders() IS 'Sends reminder notifications to clients 24 hours and 1 hour before their appointments';
