/*
  # Add Client Message Notifications

  1. New Functions
    - `notify_client_new_message()` - Notifies client when admin sends a message
  
  2. New Triggers
    - `trigger_notify_client_message` - Automatically sends notification to client on new admin message
  
  3. Changes
    - Complements existing `notify_admin_new_message` function
    - Ensures both admin and client receive notifications when messages are sent
    - Uses conversation data to identify the recipient
*/

-- Function to notify client of new message from admin
CREATE OR REPLACE FUNCTION notify_client_new_message()
RETURNS TRIGGER AS $$
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

-- Trigger to notify client when admin sends a message
CREATE TRIGGER trigger_notify_client_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_new_message();