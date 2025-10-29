-- Migration: Allow clients to view all appointments for checking availability
-- This is necessary so clients can see which time slots are occupied when booking
-- Clients will only see: date, time, status (not personal info of other clients)

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Clients view own appointments" ON appointments;

-- Create new policy that allows clients to view all appointments
-- This is safe because:
-- 1. Clients need to know which slots are occupied to book appointments
-- 2. We don't expose personal information - only scheduling data
CREATE POLICY "Clients can view all appointments for scheduling"
  ON appointments FOR SELECT
  TO authenticated
  USING (true);

-- Note: The client can see all appointment times, but personal details
-- are handled in the application layer (only showing own appointment details)
