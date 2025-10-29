/*
  # Fix notify_admin_new_request trigger function

  ## Changes
  - Cast `requested_time` to TEXT before using LEFT() function
  - This fixes the error: "Function left(time without time zone, Integer) does not exist"

  ## Technical Details
  The trigger function was trying to use LEFT(NEW.requested_time, 5) directly on a TIME column,
  but PostgreSQL's LEFT() function requires a TEXT argument. By casting to TEXT first, we resolve
  the type mismatch error.
*/

CREATE OR REPLACE FUNCTION notify_admin_new_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_id_var uuid;
  client_name_var text;
  service_name_var text;
BEGIN
  -- Get first admin
  SELECT id INTO admin_id_var
  FROM profiles
  WHERE role = 'admin'
  LIMIT 1;

  -- Get client name
  SELECT full_name INTO client_name_var
  FROM profiles
  WHERE id = NEW.client_id;

  -- Get service name
  SELECT name INTO service_name_var
  FROM services
  WHERE id = NEW.service_id;

  -- Notify admin
  IF admin_id_var IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      admin_id_var,
      'new_booking_request',
      'Нова заявка за резервация',
      client_name_var || ' иска ' || service_name_var || ' на ' || to_char(NEW.requested_date, 'DD.MM.YYYY') || ' в ' || LEFT(NEW.requested_time::text, 5),
      jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
