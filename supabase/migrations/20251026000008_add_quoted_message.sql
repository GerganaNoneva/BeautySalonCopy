-- Add quoted_message_id column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS quoted_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN messages.quoted_message_id IS 'Reference to the message being replied to (quoted message)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_quoted_message_id ON messages(quoted_message_id);
