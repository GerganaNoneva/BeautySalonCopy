/*
  # Allow admins to view all client profiles

  1. Changes
    - Add policy to allow admin users to view all profiles
    - This enables the admin dashboard clients page to display all registered clients

  2. Security
    - Policy checks that the requesting user has role = 'admin' in their profile
    - Only affects SELECT operations
    - Other operations (INSERT, UPDATE, DELETE) remain restricted
*/

-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
  );
