-- Remove DELETE policy for clients - clients should only hide requests, not delete them
-- Only admins should be able to permanently delete appointment requests

-- Drop the client DELETE policy
DROP POLICY IF EXISTS "Clients can delete all their own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own rejected requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Clients can delete their own appointment requests" ON appointment_requests;

-- Keep only admin DELETE policy
-- Verify admin policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'appointment_requests'
    AND policyname = 'Admins can delete all appointment requests'
    AND cmd = 'DELETE'
  ) THEN
    -- Create admin DELETE policy if it doesn't exist
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
    RAISE NOTICE 'Admin DELETE policy created';
  ELSE
    RAISE NOTICE 'Admin DELETE policy already exists';
  END IF;
END $$;

-- Verify the change
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'appointment_requests'
    AND cmd = 'DELETE';

    RAISE NOTICE 'Total DELETE policies for appointment_requests: %', policy_count;
    RAISE NOTICE 'Clients can now only UPDATE (hide) requests, not DELETE them';
    RAISE NOTICE 'Only admins can permanently DELETE requests';
END $$;
