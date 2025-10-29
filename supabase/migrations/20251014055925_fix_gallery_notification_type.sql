/*
  # Fix Gallery Notification Type

  1. Changes
    - Update the `notify_clients_on_photo_upload` function to use 'new_photo' instead of 'gallery_update'
    - This aligns with the notifications_type_check constraint which only allows:
      - 'free_slot'
      - 'new_photo'
      - 'booking_confirmed'
      - 'booking_cancelled'
      - 'new_message'

  2. Security
    - No changes to RLS policies
    - Function remains SECURITY DEFINER for proper notification creation
*/

-- Update the function to use correct notification type
CREATE OR REPLACE FUNCTION notify_clients_on_photo_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create notifications for all clients
  INSERT INTO notifications (user_id, type, title, body)
  SELECT 
    id,
    'new_photo',
    'Нова снимка в галерията',
    'Прегледайте новата снимка в галерията на салона'
  FROM profiles
  WHERE role = 'client';
  
  RETURN NEW;
END;
$$;