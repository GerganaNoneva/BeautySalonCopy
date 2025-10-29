/*
  # Add new_booking_request notification type

  ## Changes
  - Add 'new_booking_request' to the allowed notification types
  - Add 'booking_rejected' to the allowed notification types (used when admin rejects a request)

  ## Notes
  This fixes the error: "new row for relation notifications violates check constraint notifications_type_check"
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with new types included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'free_slot'::text, 
  'new_photo'::text, 
  'booking_confirmed'::text, 
  'booking_cancelled'::text, 
  'booking_rejected'::text,
  'new_booking_request'::text,
  'new_message'::text, 
  'gallery_update'::text, 
  'gallery_comment'::text
]));
