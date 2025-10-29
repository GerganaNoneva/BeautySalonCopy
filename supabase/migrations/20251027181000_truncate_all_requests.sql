-- Truncate appointment_requests table (removes all data)
TRUNCATE TABLE appointment_requests CASCADE;

-- Verify it's empty
DO $$
DECLARE
    req_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO req_count FROM appointment_requests;
    RAISE NOTICE 'Remaining requests after TRUNCATE: %', req_count;
END $$;
