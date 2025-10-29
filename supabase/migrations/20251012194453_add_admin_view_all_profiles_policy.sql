/*
  # Add admin policy to view all profiles

  1. Changes
    - Add new RLS policy allowing admins to view all profiles
    - This enables the admin clients page to display all registered clients

  2. Security
    - Only users with role='admin' can view all profiles
    - Regular users can still only view their own profile
*/

CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
