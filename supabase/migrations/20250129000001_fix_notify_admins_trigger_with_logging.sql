/*
  # Fix Notify Admins Trigger with Logging

  Add logging to understand why notifications are not being created.
  Also ensure the trigger works even if there are no admins yet.
*/

-- Drop and recreate the trigger function with better logging
DROP TRIGGER IF EXISTS notify_admins_on_new_client ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_admins_on_new_client();

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_client()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  admin_record RECORD;
  admin_count INTEGER;
BEGIN
  RAISE NOTICE 'notify_admins_on_new_client triggered for user: % (role: %, created_by_admin: %)',
    NEW.email, NEW.role, NEW.created_by_admin;

  -- Only proceed if this is a new client (not admin) and not created by admin
  IF NEW.role = 'client' AND (NEW.created_by_admin IS NULL OR NEW.created_by_admin = false) THEN
    RAISE NOTICE 'Condition met - this is a new self-registered client';

    -- Count admins
    SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';
    RAISE NOTICE 'Found % admin(s) in the system', admin_count;

    -- Create notification for each admin
    FOR admin_record IN
      SELECT id FROM profiles WHERE role = 'admin'
    LOOP
      RAISE NOTICE 'Creating notification for admin: %', admin_record.id;

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

      RAISE NOTICE 'Notification created successfully for admin: %', admin_record.id;
    END LOOP;

    IF admin_count = 0 THEN
      RAISE WARNING 'No admins found in system - no notifications created';
    END IF;
  ELSE
    RAISE NOTICE 'Condition NOT met - role: %, created_by_admin: %', NEW.role, NEW.created_by_admin;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER notify_admins_on_new_client
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_client();

-- Log confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger notify_admins_on_new_client created with logging enabled';
END $$;
