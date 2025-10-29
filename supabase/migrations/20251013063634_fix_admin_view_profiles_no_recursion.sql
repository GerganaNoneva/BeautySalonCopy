/*
  # Fix infinite recursion in admin view policy

  1. Changes
    - Drop the problematic recursive policy
    - Create new policy using auth.jwt() to check role from JWT token
    - This avoids recursive SELECT on profiles table

  2. Security
    - Uses JWT metadata which is set during profile creation
    - No recursive queries needed
    - Maintains same security level
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new policy using JWT instead of subquery
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
