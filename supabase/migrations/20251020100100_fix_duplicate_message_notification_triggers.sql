/*
  # Fix Duplicate Message Notification Triggers

  1. Problem
    - Two notifications are being created for each chat message
    - Possible cause: duplicate triggers or old triggers not dropped

  2. Solution
    - Drop ALL existing triggers on messages table
    - Drop ALL existing triggers on notifications table
    - Recreate only the necessary triggers
    - Ensure only one notification is created per message

  3. Changes
    - Drop and recreate trigger_notify_admin_message
    - Drop and recreate trigger_notify_client_message
    - Drop and recreate on_notification_insert
    - Add DROP IF EXISTS to prevent duplicates
*/

-- Step 1: Drop ALL existing message notification triggers (including possible old names)
DROP TRIGGER IF EXISTS trigger_notify_admin_message ON messages;
DROP TRIGGER IF EXISTS trigger_notify_client_message ON messages;
DROP TRIGGER IF EXISTS notify_admin_message_trigger ON messages;
DROP TRIGGER IF EXISTS notify_client_message_trigger ON messages;
DROP TRIGGER IF EXISTS on_message_notify_admin ON messages;
DROP TRIGGER IF EXISTS on_message_notify_client ON messages;

-- Step 2: Drop ALL existing notification triggers
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
DROP TRIGGER IF EXISTS send_push_on_notification ON notifications;
DROP TRIGGER IF EXISTS notification_push_trigger ON notifications;

-- Step 3: Recreate message notification triggers (ONE TIME EACH)
CREATE TRIGGER trigger_notify_admin_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_message();

CREATE TRIGGER trigger_notify_client_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_new_message();

-- Step 4: Recreate push notification trigger (ONE TIME)
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();
