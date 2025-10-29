/*
  # Remove Auto-Delivered Trigger

  1. Changes
    - Drop the trigger that automatically sets delivered_at on message insert
    - delivered_at should only be set when the recipient actually loads the message
    - This allows proper "sent" (1 check) vs "delivered" (2 checks) status

  2. Reasoning
    - Messages should show as "sent" (1 check) until recipient loads them
    - Only when recipient's app loads the messages, set delivered_at
*/

DROP TRIGGER IF EXISTS on_message_insert_set_delivered ON messages;
DROP FUNCTION IF EXISTS set_message_delivered();
