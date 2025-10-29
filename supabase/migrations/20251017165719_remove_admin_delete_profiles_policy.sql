/*
  # Remove admin delete policy for profiles

  1. Changes
    - Drop policy that allows admins to delete any profile
  
  2. Security
    - Only users can delete their own profiles (existing policy)
    - Admins cannot delete registered client profiles
    - Admins can only delete unregistered clients
*/

DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
