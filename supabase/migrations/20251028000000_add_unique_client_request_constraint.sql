-- Add unique constraint to prevent multiple active requests from same client for same date and time
-- This ensures one client can only have one active request (not rejected) for a specific date and time

-- First, let's check if there are any duplicate active requests
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT client_id, requested_date, requested_time, COUNT(*)
    FROM appointment_requests
    WHERE status != 'rejected'
    GROUP BY client_id, requested_date, requested_time
    HAVING COUNT(*) > 1
  ) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate active requests. Cleaning up...', duplicate_count;

    -- Keep only the oldest request for each client/date/time combination
    DELETE FROM appointment_requests
    WHERE id IN (
      SELECT id
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY client_id, requested_date, requested_time
                 ORDER BY created_at ASC
               ) AS rn
        FROM appointment_requests
        WHERE status != 'rejected'
      ) AS ranked
      WHERE rn > 1
    );
  END IF;
END $$;

-- Create a partial unique index (only for non-rejected requests)
-- This prevents duplicate active requests but allows multiple rejected ones
CREATE UNIQUE INDEX IF NOT EXISTS unique_client_active_request_per_slot
ON appointment_requests (client_id, requested_date, requested_time)
WHERE status != 'rejected';

COMMENT ON INDEX unique_client_active_request_per_slot IS
'Ensures one client can only have one active (non-rejected) request for a specific date and time';
