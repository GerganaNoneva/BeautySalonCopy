-- Consolidate and fix DELETE policies for appointment_requests
-- This ensures both admins and clients can delete appointment requests properly

-- Drop ALL existing DELETE policies to start fresh
DROP POLICY IF EXISTS "Admins can delete any request" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can delete appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own rejected requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own appointment requests" ON appointment_requests;

-- Create single admin DELETE policy
CREATE POLICY "Admins can delete any appointment request"
ON appointment_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create single client DELETE policy (allows deleting ALL own requests, not just rejected)
CREATE POLICY "Clients can delete their own appointment requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (auth.uid() = client_id);
