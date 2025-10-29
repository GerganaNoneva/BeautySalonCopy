/*
  # Add admin delete policy for profiles

  1. Changes
    - Add policy to allow admins to delete any profile
  
  2. Security
    - Only users with role = 'admin' can delete profiles
    - Uses is_admin() function which reads from profiles.role
    - This allows salon admins to manage client accounts
*/

CREATE POLICY "Admins can delete any profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin());
