/*
  # Admin Notifications System

  1. Changes
    - Create trigger to notify admin when client sends a message
    - Create trigger to notify admin when client creates appointment request

  2. Notes
    - Notifications are created automatically when events occur
    - Admin receives notification for every new message from clients
    - Admin receives notification for every new appointment request
*/

-- Function to notify admin of new client message
CREATE OR REPLACE FUNCTION notify_admin_new_message()
RETURNS TRIGGER AS $$
DECLARE
  admin_id_var uuid;
  client_name_var text;
BEGIN
  -- Get admin ID from conversation
  SELECT admin_id INTO admin_id_var
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Get client name
  SELECT full_name INTO client_name_var
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Only notify if message is from client (not admin)
  IF NEW.sender_id != admin_id_var THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      admin_id_var,
      'new_message',
      'Ново съобщение',
      client_name_var || ': ' || LEFT(NEW.content, 50),
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new messages
DROP TRIGGER IF EXISTS trigger_notify_admin_message ON messages;
CREATE TRIGGER trigger_notify_admin_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_message();

-- Function to notify admin of new appointment request
CREATE OR REPLACE FUNCTION notify_admin_new_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_id_var uuid;
  client_name_var text;
  service_name_var text;
BEGIN
  -- Get first admin (you can modify this logic as needed)
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
      client_name_var || ' иска ' || service_name_var || ' на ' || to_char(NEW.requested_date, 'DD.MM.YYYY') || ' в ' || LEFT(NEW.requested_time, 5),
      jsonb_build_object('request_id', NEW.id, 'client_id', NEW.client_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new appointment requests
DROP TRIGGER IF EXISTS trigger_notify_admin_request ON appointment_requests;
CREATE TRIGGER trigger_notify_admin_request
  AFTER INSERT ON appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_request();