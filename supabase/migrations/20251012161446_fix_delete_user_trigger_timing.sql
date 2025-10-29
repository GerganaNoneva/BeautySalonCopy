/*
  # Fix delete user trigger timing

  ## Changes
  1. Changes trigger from BEFORE DELETE to AFTER DELETE
  2. This prevents the cascade conflict when auth.users is deleted
  
  ## How it works
  - When profile is deleted, the trigger fires AFTER the deletion
  - Then it deletes the auth.users record
  - Since the profile is already gone, there's no cascade conflict
*/

-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_delete_auth_user ON profiles;

-- Recreate with AFTER DELETE instead of BEFORE DELETE
CREATE TRIGGER trigger_delete_auth_user
  AFTER DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_auth_user_on_profile_delete();
