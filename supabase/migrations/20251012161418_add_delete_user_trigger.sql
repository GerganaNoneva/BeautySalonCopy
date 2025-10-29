/*
  # Add trigger to delete auth user when profile is deleted

  ## Changes
  1. Creates a trigger function that deletes the auth.users record when a profile is deleted
  2. Adds a trigger on profiles table to call this function BEFORE DELETE
  
  ## Security
  - Uses SECURITY DEFINER to run with elevated privileges
  - Only runs when a profile is being deleted
  - Automatically maintains data consistency between auth.users and profiles
*/

-- Create function to delete auth user when profile is deleted
CREATE OR REPLACE FUNCTION delete_auth_user_on_profile_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete the auth.users record
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- Create trigger to call the function before profile deletion
DROP TRIGGER IF EXISTS trigger_delete_auth_user ON profiles;
CREATE TRIGGER trigger_delete_auth_user
  BEFORE DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_profile_delete();
