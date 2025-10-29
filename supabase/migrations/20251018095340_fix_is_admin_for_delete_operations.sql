/*
  # Fix is_admin() function for DELETE operations
  
  1. Problem
    - Current is_admin() reads from profiles table which may have RLS issues
    - This causes DELETE operations to fail silently
    - When editing appointments, old appointment is not deleted
    
  2. Solution
    - Use app_metadata from JWT which is always available
    - This bypasses any RLS issues completely
    
  3. Security
    - app_metadata is set server-side and cannot be modified by users
    - Only admins have role='admin' in app_metadata
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
END;
$$;
