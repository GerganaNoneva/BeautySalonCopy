-- Enable Realtime replication for appointment_requests and appointments tables

-- Enable replication for appointment_requests
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_requests;

-- Enable replication for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- Verify replication is enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
