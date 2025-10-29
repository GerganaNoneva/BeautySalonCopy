/*
  # Simplify and fix appointments RLS policies
  
  1. Problem
    - Current policies check profiles.role = 'admin' with complex EXISTS subqueries
    - is_admin() function exists but is not being used consistently
    - This can cause performance issues and RLS check failures
    - When viewing appointments in FreeTimeSlotsModal, appointments may not be visible
  
  2. Changes
    - Drop all existing appointments policies
    - Create new simplified policies using is_admin() function
    - Ensure admins can see ALL appointments (including unregistered clients)
    - Ensure clients can only see their own appointments
  
  3. Security
    - is_admin() uses SECURITY DEFINER to bypass RLS recursion
    - Admins have full access to all appointments
    - Clients have access only to their own appointments
    - Proper separation of concerns
*/

-- Drop all existing appointments policies
DROP POLICY IF EXISTS "Clients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Admin can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Admin can update appointments" ON appointments;
DROP POLICY IF EXISTS "Admin can delete appointments" ON appointments;
DROP POLICY IF EXISTS "Admin can create appointments for clients" ON appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can create appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can update appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can delete appointments" ON appointments;

-- Create new simplified policies

-- SELECT policies
CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Clients can view their appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- INSERT policies
CREATE POLICY "Admins can create any appointment"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Clients can create their appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- UPDATE policies
CREATE POLICY "Admins can update any appointment"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE policies
CREATE POLICY "Admins can delete any appointment"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create index to optimize RLS checks
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
