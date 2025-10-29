-- Add ALL possible notification types to fix constraint violations

-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate the constraint with ALL possible types (very permissive for now)
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
CHECK (type IN (
  'new_message',
  'new_booking_request',
  'booking_confirmed',
  'booking_rejected',
  'appointment_created',
  'appointment_updated',
  'appointment_cancelled',
  'appointment_cancelled_by_client',
  'new_photo',
  'gallery_comment',
  'new_promotion',
  'price_change',
  'free_slot',
  'appointment_reminder',
  'new_appointment',
  'appointment_confirmed',
  'appointment_reminder_24h',
  'appointment_reminder_1h',
  'message_received',
  'message_sent'
)) NOT VALID;

-- Add comment
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS
'Allowed notification types - expanded list to fix constraint violations';
