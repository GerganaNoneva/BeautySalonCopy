-- Check if tables are in Realtime publication
SELECT
    schemaname,
    tablename,
    'In supabase_realtime publication' as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('appointment_requests', 'appointments')
ORDER BY tablename;

-- Check RLS policies for appointment_requests
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'appointment_requests'
ORDER BY policyname;

-- Check RLS policies for appointments
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'appointments'
ORDER BY policyname;
