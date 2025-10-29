/*
  # Fix admin view policy with helper function

  1. Changes
    - Create helper function to check if user is admin
    - Use SECURITY DEFINER to avoid recursion issues
    - Update policy to use the helper function

  2. Security
    - Function runs with owner privileges to avoid RLS recursion
    - Still checks auth.uid() to ensure proper authorization
*/

-- Drop the problematic policy first
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create a helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy using the helper function
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());
