/*
  # Fix appointments INSERT policy for unregistered clients

  1. Problem
    - Current INSERT policy only allows client_id = auth.uid()
    - When admin creates appointment with unregistered_client_id, it fails
    - Admin INSERT policy checks is_admin() but doesn't cover unregistered clients

  2. Changes
    - Drop ALL existing policies for appointments
    - Recreate all policies with proper handling of unregistered clients
    - Admin can insert/update/delete appointments with either client_id OR unregistered_client_id
    - Clients can only work with appointments that have their client_id

  3. Security
    - Admins have full access to all appointments (registered or unregistered)
    - Clients can only access their own appointments
*/

-- Drop ALL existing policies for appointments
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can create any appointment" ON appointments;
DROP POLICY IF EXISTS "Clients can create their appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Admin can create appointments for clients" ON appointments;
DROP POLICY IF EXISTS "Admins can create appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create own appointments" ON appointments;
DROP POLICY IF EXISTS "Admins can update any appointment" ON appointments;
DROP POLICY IF EXISTS "Admins can delete any appointment" ON appointments;

-- SELECT policies
DROP POLICY IF EXISTS "Admins view all appointments" ON appointments;
CREATE POLICY "Admins view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Clients view own appointments" ON appointments;
CREATE POLICY "Clients view own appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- INSERT policies
DROP POLICY IF EXISTS "Admins insert appointments" ON appointments;
CREATE POLICY "Admins insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Clients insert own appointments" ON appointments;
CREATE POLICY "Clients insert own appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND unregistered_client_id IS NULL
  );

-- UPDATE policies
DROP POLICY IF EXISTS "Admins update appointments" ON appointments;
CREATE POLICY "Admins update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE policies
DROP POLICY IF EXISTS "Admins delete appointments" ON appointments;
CREATE POLICY "Admins delete appointments"
  ON appointments FOR DELETE
  TO authenticated
  USING (is_admin());
