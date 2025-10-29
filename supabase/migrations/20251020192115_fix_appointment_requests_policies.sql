-- Fix RLS policies for appointment_requests table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Users can insert their own appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can view all appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can update appointment requests" ON appointment_requests;
DROP POLICY IF EXISTS "Admins can delete appointment requests" ON appointment_requests;

-- Enable RLS
ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can insert their own appointment requests
CREATE POLICY "Clients can insert appointment requests"
ON appointment_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Policy: Clients can view their own appointment requests
CREATE POLICY "Clients can view own appointment requests"
ON appointment_requests
FOR SELECT
TO authenticated
USING (auth.uid() = client_id);

-- Policy: Admins can view all appointment requests
CREATE POLICY "Admins can view all appointment requests"
ON appointment_requests
FOR SELECT
TO authenticated
USING (is_admin());

-- Policy: Admins can update all appointment requests
CREATE POLICY "Admins can update appointment requests"
ON appointment_requests
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Policy: Admins can delete appointment requests
CREATE POLICY "Admins can delete appointment requests"
ON appointment_requests
FOR DELETE
TO authenticated
USING (is_admin());
