/*
  # Enable Realtime for notifications and messages tables

  This migration enables real-time subscriptions for:
  - notifications table: to allow instant badge updates when notifications are created/updated
  - messages table: to allow instant badge updates when messages are sent/read

  ## Changes
  1. Enable realtime publication for notifications table
  2. Enable realtime publication for messages table

  ## Why this is needed
  Without realtime enabled, postgres_changes subscriptions won't work and badge counts won't update automatically.
*/

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;