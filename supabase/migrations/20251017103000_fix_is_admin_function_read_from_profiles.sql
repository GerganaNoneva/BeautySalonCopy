/*
  # Fix is_admin() function to read from profiles table

  1. Changes
    - Update is_admin() to read from profiles.role column
    - Use SECURITY DEFINER to bypass RLS and avoid recursion
    - This allows admin policies to work correctly

  2. Security
    - Function runs with elevated privileges (SECURITY DEFINER)
    - Still validates auth.uid() to ensure proper authorization
    - Prevents infinite recursion in RLS policies
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(user_role = 'admin', false);
END;
$$;
