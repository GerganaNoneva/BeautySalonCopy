-- Allow clients to delete their own appointment requests
-- This enables clients to cancel their booking requests

CREATE POLICY "Clients can delete own appointment requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (auth.uid() = client_id);
