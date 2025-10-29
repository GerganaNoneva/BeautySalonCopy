/*
  # Fix unregistered_clients RLS policies to use is_admin column

  1. Changes
    - Drop old policies that check profiles.role = 'admin'
    - Create new policies that use is_admin() function
    - This matches how other admin policies work in the system

  2. Security
    - Only admins can access unregistered_clients table
    - Uses the same is_admin() function as other tables
*/

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can create unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can update unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can delete unregistered clients" ON unregistered_clients;

-- Create new policies using is_admin() function
CREATE POLICY "Admins can view all unregistered clients"
  ON unregistered_clients FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can create unregistered clients"
  ON unregistered_clients FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update unregistered clients"
  ON unregistered_clients FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete unregistered clients"
  ON unregistered_clients FOR DELETE
  TO authenticated
  USING (is_admin());
