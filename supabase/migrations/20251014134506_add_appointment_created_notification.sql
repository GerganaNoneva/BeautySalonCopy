/*
  # Add notification when appointment is created
  
  1. Purpose
    - Automatically send notification to client when admin creates appointment
    
  2. Changes
    - Create trigger function to insert notification on new appointment
    - Create trigger on appointments INSERT
    
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
*/

-- Create function to notify client about new appointment
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
  -- Get service name
  SELECT name INTO service_name FROM services WHERE id = NEW.service_id;
  
  -- Format time and date
  appointment_time := SUBSTRING(NEW.start_time::TEXT, 1, 5);
  appointment_date_formatted := TO_CHAR(NEW.appointment_date, 'DD.MM.YYYY');
  
  -- Insert notification for client
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    NEW.client_id,
    'booking_confirmed',
    'Нова резервация',
    'Вашата резервация за ' || COALESCE(service_name, 'услуга') || ' на ' || appointment_date_formatted || ' в ' || appointment_time || ' е потвърдена.'
  );
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS appointment_created_notification ON appointments;

-- Create trigger
CREATE TRIGGER appointment_created_notification
AFTER INSERT ON appointments
FOR EACH ROW
EXECUTE FUNCTION notify_client_on_appointment_created();
