/*
  # Add push notification token support

  1. Changes
    - Add push_token column to profiles table for storing Expo push tokens
    - This enables sending push notifications to users

  2. Security
    - Users can only update their own push token
    - RLS policies already in place will handle access control
*/

-- Add push_token column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_token text DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token);
