-- Change status from 'time_suggested' to 'changed' for appointment_requests

-- Update the status check constraint to replace 'time_suggested' with 'changed'
ALTER TABLE appointment_requests
DROP CONSTRAINT IF EXISTS appointment_requests_status_check;

ALTER TABLE appointment_requests
ADD CONSTRAINT appointment_requests_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'changed'));

-- Update any existing records that have 'time_suggested' status to 'changed'
UPDATE appointment_requests
SET status = 'changed'
WHERE status = 'time_suggested';
