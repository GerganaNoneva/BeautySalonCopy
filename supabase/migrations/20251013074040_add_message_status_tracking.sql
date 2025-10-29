/*
  # Add message status tracking

  1. Changes
    - Add delivered_at column to track when message was delivered
    - Add read_at column to track when message was read
    - Keep existing read boolean for backward compatibility
    - Add indexes for faster status queries

  2. Status Flow
    - Message sent: created_at set
    - Message delivered: delivered_at set (when recipient is online)
    - Message read: read_at set + read = true (when recipient opens chat)
*/

-- Add status tracking columns
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS delivered_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS read_at timestamptz DEFAULT NULL;

-- Update existing read messages to have read_at
UPDATE messages
SET read_at = created_at
WHERE read = true AND read_at IS NULL;

-- Create indexes for status queries
CREATE INDEX IF NOT EXISTS idx_messages_delivered_at ON messages(delivered_at);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);

-- Update trigger to set delivered_at when message is inserted
CREATE OR REPLACE FUNCTION set_message_delivered()
RETURNS TRIGGER AS $$
BEGIN
  NEW.delivered_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_message_insert_set_delivered ON messages;
CREATE TRIGGER on_message_insert_set_delivered
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_delivered();
