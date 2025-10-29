/*
  # Fix is_admin() function to use app_metadata

  1. Changes
    - Replace is_admin() function to read from auth.jwt() app_metadata
    - This avoids recursive RLS checks on profiles table
    - Uses secure data from JWT that cannot be modified by users
  
  2. Security
    - app_metadata is set by the system and cannot be changed by users
    - SECURITY DEFINER ensures function runs with elevated privileges
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$;
