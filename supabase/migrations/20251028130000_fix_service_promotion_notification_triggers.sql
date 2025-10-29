-- Fix service and promotion notification triggers to bypass RLS properly

-- Drop existing functions
DROP FUNCTION IF EXISTS notify_clients_new_service() CASCADE;
DROP FUNCTION IF EXISTS notify_clients_service_updated() CASCADE;
DROP FUNCTION IF EXISTS notify_clients_new_promotion() CASCADE;
DROP FUNCTION IF EXISTS notify_clients_promotion_updated() CASCADE;

-- Function for new service notifications
CREATE OR REPLACE FUNCTION notify_clients_new_service()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    SELECT
      id,
      'new_service',
      'Нова услуга!',
      'Добавена е нова услуга: ' || NEW.name,
      jsonb_build_object(
        'service_id', NEW.id,
        'service_name', NEW.name
      ),
      false
    FROM public.profiles
    WHERE role = 'client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for service update notifications
CREATE OR REPLACE FUNCTION notify_clients_service_updated()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_active = true THEN
    IF OLD.name != NEW.name OR
       OLD.price != NEW.price OR
       OLD.description != NEW.description OR
       OLD.duration_minutes != NEW.duration_minutes THEN

      INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
      SELECT
        id,
        'service_updated',
        'Промяна в услуга',
        'Услугата "' || NEW.name || '" е обновена',
        jsonb_build_object(
          'service_id', NEW.id,
          'service_name', NEW.name
        ),
        false
      FROM public.profiles
      WHERE role = 'client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for new promotion notifications
CREATE OR REPLACE FUNCTION notify_clients_new_promotion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    SELECT
      id,
      'new_promotion',
      'Специална промоция!',
      'Проверете промоцията: ' || NEW.name,
      jsonb_build_object(
        'promotion_id', NEW.id,
        'promotion_name', NEW.name
      ),
      false
    FROM public.profiles
    WHERE role = 'client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for promotion update notifications
CREATE OR REPLACE FUNCTION notify_clients_promotion_updated()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_active = true THEN
    IF OLD.name != NEW.name OR
       OLD.price != NEW.price OR
       OLD.description != NEW.description OR
       OLD.duration_minutes != NEW.duration_minutes THEN

      INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
      SELECT
        id,
        'promotion_updated',
        'Промяна в промоция',
        'Промоцията "' || NEW.name || '" е обновена',
        jsonb_build_object(
          'promotion_id', NEW.id,
          'promotion_name', NEW.name
        ),
        false
      FROM public.profiles
      WHERE role = 'client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate all triggers
DROP TRIGGER IF EXISTS trigger_notify_new_service ON services;
DROP TRIGGER IF EXISTS trigger_notify_service_updated ON services;
DROP TRIGGER IF EXISTS trigger_notify_new_promotion ON promotions;
DROP TRIGGER IF EXISTS trigger_notify_promotion_updated ON promotions;

CREATE TRIGGER trigger_notify_new_service
  AFTER INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_new_service();

CREATE TRIGGER trigger_notify_service_updated
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_service_updated();

CREATE TRIGGER trigger_notify_new_promotion
  AFTER INSERT ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_new_promotion();

CREATE TRIGGER trigger_notify_promotion_updated
  AFTER UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_promotion_updated();
