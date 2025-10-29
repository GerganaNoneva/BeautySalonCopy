/*
  # Add created_by_admin flag to profiles

  ## Changes
  - Add `created_by_admin` boolean column to profiles table
  - Default is false for self-registered users
  - Admin-created clients will have this set to true

  ## Notes
  - This flag helps determine if phone verification is required
  - Self-registered users need phone verification
  - Admin-created users skip phone verification
*/

-- Add created_by_admin column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'created_by_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN created_by_admin boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Set existing profiles with phone as created by admin (assumption)
UPDATE profiles SET created_by_admin = true WHERE role = 'client' AND phone IS NOT NULL;
