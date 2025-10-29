/*
  # Add Notification for Gallery Comments

  1. Changes
    - Create function to notify admin when client comments on photo
    - Add trigger on gallery_comments table
    - Notification includes photo_id in metadata for navigation

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Only notifies users with role 'admin'
*/

-- Function to notify admin when client comments on photo
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

  -- Create notification for all admins with photo_id in metadata
  INSERT INTO notifications (user_id, type, title, body, metadata)
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

-- Trigger to notify admin when client comments
DROP TRIGGER IF EXISTS trigger_notify_gallery_comment ON gallery_comments;
CREATE TRIGGER trigger_notify_gallery_comment
  AFTER INSERT ON gallery_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_gallery_comment();
