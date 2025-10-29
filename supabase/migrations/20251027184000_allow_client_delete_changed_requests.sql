-- Allow clients to DELETE their own requests ONLY if status is 'changed'
-- This is needed when client accepts or rejects a time suggestion
-- The request should be deleted completely (visible to neither client nor admin)

CREATE POLICY "Clients can delete their own changed requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = client_id
  AND status = 'changed'
);

-- Verify the policy was created
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'appointment_requests'
    AND cmd = 'DELETE';

    RAISE NOTICE 'Total DELETE policies for appointment_requests: %', policy_count;
    RAISE NOTICE 'Clients can now DELETE requests with status = changed';
    RAISE NOTICE 'Clients CANNOT DELETE requests with status = pending or rejected';
END $$;
