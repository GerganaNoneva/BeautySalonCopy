/*
  # Add Phone Verification Support

  1. Changes to profiles table
    - Add `phone_verified` boolean column to track phone verification status
    - Set default value to false for new records
    - Update existing records to have phone_verified as false

  2. Notes
    - Phone field already exists in the profiles table
    - This migration only adds the verification status tracking
*/

-- Add phone_verified column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verified boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Update existing records to have phone_verified as false
UPDATE profiles SET phone_verified = false WHERE phone_verified IS NULL;