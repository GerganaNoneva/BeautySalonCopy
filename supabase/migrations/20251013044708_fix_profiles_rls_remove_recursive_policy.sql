/*
  # Fix Profiles RLS - Remove Recursive Policy

  1. Changes
    - Drop the recursive "Admins can view all profiles" policy
    - Keep only the basic "Users can view own profile" policy
    - This prevents infinite recursion when loading profiles

  2. Security
    - Users can still view their own profile
    - Admin functionality doesn't need a separate view-all policy at the RLS level
    - Admin checks are handled in the application layer
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
