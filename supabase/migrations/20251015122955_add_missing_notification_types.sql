/*
  # Add missing notification types

  ## Changes
  - Add 'booking_updated' notification type (used when admin updates appointment time)
  - Add 'appointment_request' notification type (used when client creates a booking request)

  ## Notes
  This ensures all notification types used in the application are properly validated by the database.
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with all notification types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'free_slot'::text, 
  'new_photo'::text, 
  'booking_confirmed'::text, 
  'booking_cancelled'::text, 
  'booking_rejected'::text,
  'booking_updated'::text,
  'new_booking_request'::text,
  'appointment_request'::text,
  'new_message'::text, 
  'gallery_update'::text, 
  'gallery_comment'::text
]));
