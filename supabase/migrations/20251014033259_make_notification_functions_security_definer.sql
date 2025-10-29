/*
  # Make Notification Functions Security Definer

  1. Changes
    - Update all notification trigger functions to use SECURITY DEFINER
    - This allows them to bypass RLS when inserting notifications
    - Functions run with the privileges of the user who created them (superuser)
  
  2. Functions Updated
    - notify_admin_new_message
    - notify_client_new_message
*/

-- Update admin notification function
CREATE OR REPLACE FUNCTION notify_admin_new_message()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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

-- Update client notification function
CREATE OR REPLACE FUNCTION notify_client_new_message()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_id_var uuid;
  admin_name_var text;
BEGIN
  -- Get client ID from conversation
  SELECT client_id INTO client_id_var
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Get admin name
  SELECT full_name INTO admin_name_var
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Only notify if message is from admin (not client)
  IF NEW.sender_id != client_id_var THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      client_id_var,
      'new_message',
      'Ново съобщение от салона',
      admin_name_var || ': ' || LEFT(NEW.content, 50),
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;