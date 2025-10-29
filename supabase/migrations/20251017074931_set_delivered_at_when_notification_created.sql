/*
  # Set delivered_at When Message Notification is Created
  
  1. Changes
    - Update notify_admin_new_message to set delivered_at on the message after creating notification
    - Update notify_client_new_message to set delivered_at on the message after creating notification
    - This marks the message as "delivered" when the notification is created
  
  2. Behavior
    - Message status "Sent" (2 gray checks) = message created
    - Message status "Delivered" (1 blue + 1 gray check) = notification created (delivered_at set)
    - Message status "Read" (2 blue checks) = message opened in chat (read_at set)
*/

-- Update admin notification function to set delivered_at
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
    -- Create notification
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      admin_id_var,
      'new_message',
      'Ново съобщение',
      client_name_var || ': ' || LEFT(NEW.content, 50),
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
    
    -- Mark message as delivered
    UPDATE messages 
    SET delivered_at = NOW() 
    WHERE id = NEW.id AND delivered_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update client notification function to set delivered_at
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
    -- Create notification
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      client_id_var,
      'new_message',
      'Ново съобщение от салона',
      admin_name_var || ': ' || LEFT(NEW.content, 50),
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
    
    -- Mark message as delivered
    UPDATE messages 
    SET delivered_at = NOW() 
    WHERE id = NEW.id AND delivered_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;