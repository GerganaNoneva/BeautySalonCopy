-- Add appointment_cancelled_by_client to allowed notification types

-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the constraint with the new type included (NOT VALID to skip validation of existing rows)
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'new_message',
  'new_booking_request',
  'booking_confirmed',
  'booking_rejected',
  'appointment_created',
  'appointment_updated',
  'appointment_cancelled',
  'appointment_cancelled_by_client',  -- NEW TYPE
  'new_photo',
  'gallery_comment',
  'new_promotion',
  'price_change',
  'free_slot',
  'appointment_reminder',
  'new_appointment'  -- Add this too in case it exists
)) NOT VALID;

-- Now validate the constraint (will fail if there are invalid rows)
-- ALTER TABLE notifications VALIDATE CONSTRAINT notifications_type_check;

-- Add comment
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS
'Allowed notification types including appointment_cancelled_by_client for client-initiated cancellations';
