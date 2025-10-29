/*
  # Fix Gallery Comments and Notifications Schema
  
  1. Changes
    - Drop and recreate gallery_comments foreign key to reference profiles instead of auth.users
    - Update notification trigger to use 'data' column instead of 'metadata'
    - Ensure proper relationships for PostgREST embedding
  
  2. Security
    - Maintains existing RLS policies
    - No changes to security model
*/

-- Drop existing foreign key constraint
ALTER TABLE gallery_comments 
DROP CONSTRAINT IF EXISTS gallery_comments_user_id_fkey;

-- Add new foreign key constraint to profiles
ALTER TABLE gallery_comments 
ADD CONSTRAINT gallery_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Fix notification trigger to use 'data' instead of 'metadata'
CREATE OR REPLACE FUNCTION notify_admin_on_gallery_comment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  commenter_name text;
  photo_caption text;
BEGIN
  -- Get commenter's name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Get photo caption (first 50 chars)
  SELECT COALESCE(SUBSTRING(caption FROM 1 FOR 50), 'Снимка') INTO photo_caption
  FROM gallery_photos
  WHERE id = NEW.photo_id;

  -- Create notification for all admins with photo_id in data
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    id,
    'gallery_comment',
    'Нов коментар от ' || commenter_name,
    'Коментар към: ' || photo_caption,
    jsonb_build_object('photo_id', NEW.photo_id, 'comment_id', NEW.id)
  FROM profiles
  WHERE role = 'admin';

  RETURN NEW;
END;
$$;