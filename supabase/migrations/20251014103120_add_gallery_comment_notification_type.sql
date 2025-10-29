/*
  # Add gallery_comment to notification types
  
  1. Changes
    - Update notifications.type check constraint to include 'gallery_comment' and 'gallery_update'
  
  2. Security
    - No changes to RLS policies
*/

-- Drop existing check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new check constraint with gallery types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'free_slot'::text,
  'new_photo'::text,
  'booking_confirmed'::text,
  'booking_cancelled'::text,
  'new_message'::text,
  'gallery_update'::text,
  'gallery_comment'::text
]));