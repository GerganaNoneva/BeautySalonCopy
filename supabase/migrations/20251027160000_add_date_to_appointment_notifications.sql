-- Add date to appointment notification data so admins can navigate to the correct day in schedule

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

  -- Insert notification for client with appointment_id and date in data
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.client_id,
    'booking_confirmed',
    'Нова резервация',
    'Вашата резервация за ' || COALESCE(service_name, 'услуга') || ' на ' || appointment_date_formatted || ' в ' || appointment_time || ' е потвърдена.',
    jsonb_build_object(
      'appointment_id', NEW.id,
      'date', NEW.appointment_date::TEXT
    )
  );

  RETURN NEW;
END;
$$;
