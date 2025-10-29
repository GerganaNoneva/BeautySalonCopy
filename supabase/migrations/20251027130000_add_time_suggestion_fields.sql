-- Add fields for time suggestion feature to appointment_requests table

-- Add suggested time fields
ALTER TABLE appointment_requests
ADD COLUMN IF NOT EXISTS suggested_date DATE,
ADD COLUMN IF NOT EXISTS suggested_start_time TIME,
ADD COLUMN IF NOT EXISTS suggested_end_time TIME;

-- Update the status check constraint to include 'time_suggested'
ALTER TABLE appointment_requests
DROP CONSTRAINT IF EXISTS appointment_requests_status_check;

ALTER TABLE appointment_requests
ADD CONSTRAINT appointment_requests_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'time_suggested'));
