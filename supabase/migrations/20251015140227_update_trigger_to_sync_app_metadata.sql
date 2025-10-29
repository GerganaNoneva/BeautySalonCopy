/*
  # Update profile creation trigger to sync app_metadata

  1. Changes
    - Modify handle_new_user() to also update auth.users.raw_app_meta_data
    - This ensures the role is stored in JWT for RLS checks
    - Prevents recursive RLS issues with is_admin() function
  
  2. Security
    - Trigger runs with SECURITY DEFINER for necessary permissions
    - app_metadata can only be set by system, not by users
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

  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, phone, phone_verified)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_role,
    NEW.raw_user_meta_data->>'avatar_url',
    NULL,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- Update app_metadata with role for JWT
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(user_role)
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
