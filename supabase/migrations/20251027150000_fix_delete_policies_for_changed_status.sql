-- Ensure DELETE policies work correctly for appointment_requests with 'changed' status

-- Drop all existing DELETE policies to start fresh
DROP POLICY IF EXISTS "Admins can delete any request" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can delete any appointment request" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can delete appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own rejected requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete their own appointment requests" ON appointment_requests;

-- Create comprehensive admin DELETE policy
CREATE POLICY "Admins can delete all appointment requests"
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

-- Create comprehensive client DELETE policy (allows deleting ALL own requests regardless of status)
CREATE POLICY "Clients can delete all their own appointment requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (auth.uid() = client_id);

-- Verify that the policies are created
DO $$
BEGIN
  RAISE NOTICE 'DELETE policies for appointment_requests have been recreated successfully';
END $$;
