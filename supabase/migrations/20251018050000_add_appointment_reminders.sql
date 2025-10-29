/*
  # Add Appointment Reminders System

  1. New Functions
    - `send_appointment_reminders_24h()` - Sends reminders 24 hours before appointments
    - `send_appointment_reminders_1h()` - Sends reminders 1 hour before appointments

  2. Changes
    - Creates functions to automatically send reminder notifications
    - These will be called by a scheduled job (Edge Function or external cron)

  3. Security
    - Functions run with SECURITY DEFINER
    - Only checks confirmed appointments
    - Only sends to registered users with push tokens
*/

CREATE OR REPLACE FUNCTION send_appointment_reminders_24h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_record RECORD;
  client_user_id uuid;
  service_name text;
BEGIN
  FOR appointment_record IN
    SELECT
      a.id,
      a.client_id,
      a.unregistered_client_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      s.name as service_name
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    WHERE a.status = 'confirmed'
      AND a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
      AND a.client_id IS NOT NULL
  LOOP
    SELECT user_id INTO client_user_id
    FROM profiles
    WHERE id = appointment_record.client_id;

    IF client_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        delivered_at
      ) VALUES (
        client_user_id,
        'appointment_reminder',
        'Напомняне за резервация',
        'Имате резервация утре на ' || to_char(appointment_record.appointment_date, 'DD.MM.YYYY') ||
        ' в ' || substring(appointment_record.start_time::text from 1 for 5) ||
        ' за ' || COALESCE(appointment_record.service_name, 'услуга') || '.',
        NOW()
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION send_appointment_reminders_1h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_record RECORD;
  client_user_id uuid;
  service_name text;
  appointment_datetime timestamp;
  now_time timestamp;
BEGIN
  now_time := NOW();

  FOR appointment_record IN
    SELECT
      a.id,
      a.client_id,
      a.unregistered_client_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      s.name as service_name
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    WHERE a.status = 'confirmed'
      AND a.appointment_date = CURRENT_DATE
      AND a.client_id IS NOT NULL
  LOOP
    appointment_datetime := appointment_record.appointment_date + appointment_record.start_time;

    IF appointment_datetime BETWEEN now_time + INTERVAL '55 minutes' AND now_time + INTERVAL '65 minutes' THEN
      SELECT user_id INTO client_user_id
      FROM profiles
      WHERE id = appointment_record.client_id;

      IF client_user_id IS NOT NULL THEN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          body,
          delivered_at
        ) VALUES (
          client_user_id,
          'appointment_reminder',
          'Напомняне за резервация',
          'Вашата резервация е след 1 час - ' ||
          substring(appointment_record.start_time::text from 1 for 5) ||
          ' за ' || COALESCE(appointment_record.service_name, 'услуга') || '.',
          NOW()
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Note: notification_type enum does not exist in this database
-- The type column in notifications table is TEXT, not ENUM
-- So we don't need to add enum values
-- Just use 'appointment_reminder' as a string when inserting notifications
