/*
  # Remove Phone Verification Requirement

  ## Changes
  - Set all phone_verified to true (no verification needed)
  - Make phone_verified column nullable and default to true

  ## Notes
  - Phone verification is no longer required for the app
  - All existing users will have verified phones by default
*/

-- Set all existing records to verified
UPDATE profiles SET phone_verified = true WHERE phone_verified = false OR phone_verified IS NULL;

-- Alter column to be nullable and default to true
ALTER TABLE profiles ALTER COLUMN phone_verified SET DEFAULT true;
ALTER TABLE profiles ALTER COLUMN phone_verified DROP NOT NULL;
