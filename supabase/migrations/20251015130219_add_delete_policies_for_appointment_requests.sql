/*
  # Add DELETE policies for appointment_requests

  ## Changes
  - Add policy for admins to delete any appointment request
  - Add policy for clients to delete their own rejected appointment requests

  ## Security
  - Admins can delete any request (full access)
  - Clients can only delete their own requests that have been rejected
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can delete any request" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own rejected requests" ON appointment_requests;

-- Allow admins to delete any appointment request
CREATE POLICY "Admins can delete any request"
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

-- Allow clients to delete their own rejected requests
CREATE POLICY "Clients can delete own rejected requests"
  ON appointment_requests
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id
    AND status = 'rejected'
  );
