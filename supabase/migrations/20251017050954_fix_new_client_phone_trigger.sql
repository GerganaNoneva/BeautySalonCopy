/*
  # Fix Profile Creation Trigger - Include Phone from Metadata

  1. Changes
    - Update handle_new_user function to extract phone from raw_user_meta_data
    - Set phone_verified to true if phone is provided during signup
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
  user_full_name TEXT;
  user_phone TEXT;
BEGIN
  -- Determine role based on email
  IF NEW.email = 'gergananoneva@gmail.com' THEN
    user_role := 'admin';
  ELSE
    user_role := 'client';
  END IF;

  -- Extract full name from metadata or email
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Extract phone from metadata
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- Insert or update profile
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, phone, phone_verified)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role,
    NEW.raw_user_meta_data->>'avatar_url',
    user_phone,
    CASE WHEN user_phone IS NOT NULL AND user_phone != '' THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    phone_verified = EXCLUDED.phone_verified;

  RETURN NEW;
END;
$$;
