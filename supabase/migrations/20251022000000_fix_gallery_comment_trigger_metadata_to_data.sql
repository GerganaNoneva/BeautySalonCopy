/*
  # Fix Gallery Comment Notification Trigger

  1. Changes
    - Fix trigger to use 'data' instead of 'metadata' column
    - The notifications table has a column called 'data', not 'metadata'

  2. Security
    - Function maintains SECURITY DEFINER
*/

-- Drop and recreate function with correct column name
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

  -- Create notification for all admins with photo_id in DATA (not metadata)
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
