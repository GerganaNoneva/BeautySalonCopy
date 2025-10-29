/*
  # Auto-confirm emails for development

  1. Changes
    - Update trigger to automatically confirm email on signup
    - This is useful for development/testing environments
    - In production, email confirmation should be enabled via Supabase dashboard
  
  2. Security
    - Only use in development environments
    - For production, enable email confirmation in Supabase Auth settings
*/

-- Update the handle_new_user function to auto-confirm email
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

  -- Auto-confirm email if not already confirmed
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id;
  END IF;

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

  RETURN NEW;
END;
$$;
