/*
  # Add promotion notification types
  
  ## Changes
  - Add 'new_promotion' notification type (used when admin creates a new promotion)
  - Add 'price_change' notification type (used when admin updates promotion price)
  
  ## Notes
  This ensures promotion-related notifications work properly in the application.
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with all notification types including promotion types
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
  'gallery_comment'::text,
  'new_promotion'::text,
  'price_change'::text
]));