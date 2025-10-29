/*
  # Notify Admins on New Client Registration

  Creates a trigger to notify all admins when a new client registers.
  This catches all registration methods: email/password, Google OAuth, Facebook OAuth, etc.
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS notify_admins_on_new_client ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_admins_on_new_client();

-- Create function to notify admins when a new client registers
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_client()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Only proceed if this is a new client (not admin) and not created by admin
  IF NEW.role = 'client' AND (NEW.created_by_admin IS NULL OR NEW.created_by_admin = false) THEN
    -- Create notification for each admin
    FOR admin_record IN
      SELECT id FROM profiles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data, is_read)
      VALUES (
        admin_record.id,
        'new_client_registration',
        'Нова регистрация',
        NEW.full_name || ' се регистрира в системата',
        jsonb_build_object(
          'client_id', NEW.id,
          'client_name', NEW.full_name,
          'client_email', NEW.email,
          'client_phone', NEW.phone
        ),
        false
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER notify_admins_on_new_client
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_client();
