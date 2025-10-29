/*
  # Add price_change notification type

  1. Changes
    - Add 'price_change' notification type
    - Used when admin changes the price of a service
    - All registered clients will receive notification about the price change

  2. Notes
    - This notification type is created when a service price is updated
    - Notification body includes old and new price
*/

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the constraint with price_change notification type
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
  'promotion'::text,
  'appointment_created'::text,
  'price_change'::text
]));
