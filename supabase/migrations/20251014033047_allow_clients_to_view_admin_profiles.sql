/*
  # Allow clients to view admin profiles

  1. Changes
    - Add policy to allow all authenticated users to view admin profiles
    - This is needed so clients can find the admin to create conversations with
    - Restricts visibility to only the admin role, not all profile data
  
  2. Security
    - Only admin profiles are visible
    - Only to authenticated users
    - Read-only access
*/

-- Allow all authenticated users to view admin profiles
CREATE POLICY "Anyone can view admin profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (role = 'admin');