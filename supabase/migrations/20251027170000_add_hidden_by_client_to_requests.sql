-- Add hidden_by_client field to allow soft delete of requests by clients
-- When client "clears" rejected requests, they are hidden from client view but still visible to admin

ALTER TABLE appointment_requests
ADD COLUMN IF NOT EXISTS hidden_by_client BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_appointment_requests_hidden_by_client
ON appointment_requests(hidden_by_client)
WHERE hidden_by_client = FALSE;

COMMENT ON COLUMN appointment_requests.hidden_by_client IS
'Indicates if the client has hidden this request from their view. Admin can still see it.';
