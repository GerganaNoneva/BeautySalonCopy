/*
  # Add file and voice message support to messages

  1. Changes
    - Add `attachment_type` column to messages table (text, audio, image, file, null)
    - Add `attachment_url` column for Base64 data or file URLs
    - Add `attachment_name` column for original filename
    - Add `attachment_size` column for file size in bytes
    - Add `attachment_duration` column for audio message duration in seconds
  
  2. Purpose
    - Allow users to send files, images, and voice recordings
    - Store attachment metadata for proper display
    - Support Base64 encoding for small files
  
  3. Security
    - Attachment URL will store Base64 data directly (no external storage)
    - RLS policies already cover message access
*/

-- Add attachment columns to messages table
DO $$
BEGIN
  -- Add attachment_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_type text;
    COMMENT ON COLUMN messages.attachment_type IS 'Type of attachment: text, audio, image, file, or null';
  END IF;

  -- Add attachment_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_url text;
    COMMENT ON COLUMN messages.attachment_url IS 'Base64 data URL or file URL';
  END IF;

  -- Add attachment_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_name text;
    COMMENT ON COLUMN messages.attachment_name IS 'Original filename';
  END IF;

  -- Add attachment_size column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_size'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_size integer;
    COMMENT ON COLUMN messages.attachment_size IS 'File size in bytes';
  END IF;

  -- Add attachment_duration column for audio
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_duration'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_duration integer;
    COMMENT ON COLUMN messages.attachment_duration IS 'Audio duration in seconds';
  END IF;
END $$;

-- Add check constraint for valid attachment types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_attachment_type_check'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_attachment_type_check
    CHECK (attachment_type IN ('text', 'audio', 'image', 'file') OR attachment_type IS NULL);
  END IF;
END $$;
