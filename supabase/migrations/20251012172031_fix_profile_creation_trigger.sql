/*
  # Fix Profile Creation with Trigger

  1. Changes
    - Create trigger function to automatically create profile on user signup
    - Profile is created immediately after auth.users insert
    - This bypasses RLS issues during registration
  
  2. Security
    - Trigger runs with SECURITY DEFINER (as database owner)
    - RLS policies remain intact for all other operations
    - Users can still only view/update their own profiles
*/

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user creation
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

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
