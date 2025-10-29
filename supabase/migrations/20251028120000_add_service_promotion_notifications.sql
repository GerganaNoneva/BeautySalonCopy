-- Миграция за автоматични уведомления при създаване/редакция на услуги и промоции

-- Функция за изпращане на уведомления на всички клиенти при нова услуга
CREATE OR REPLACE FUNCTION notify_clients_new_service()
RETURNS TRIGGER AS $$
BEGIN
  -- Изпращаме уведомление само при INSERT (нова услуга)
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    -- Вмъкваме уведомление за всеки клиент
    INSERT INTO notifications (user_id, type, title, body, data, is_read)
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
    FROM profiles
    WHERE role = 'client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция за изпращане на уведомления на всички клиенти при промяна в услуга
CREATE OR REPLACE FUNCTION notify_clients_service_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Изпращаме уведомление само при UPDATE и ако е активна
  IF TG_OP = 'UPDATE' AND NEW.is_active = true THEN
    -- Проверяваме дали има значима промяна (име, цена или описание)
    IF OLD.name != NEW.name OR
       OLD.price != NEW.price OR
       OLD.description != NEW.description OR
       OLD.duration_minutes != NEW.duration_minutes THEN

      -- Вмъкваме уведомление за всеки клиент
      INSERT INTO notifications (user_id, type, title, body, data, is_read)
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
      FROM profiles
      WHERE role = 'client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция за изпращане на уведомления на всички клиенти при нова промоция
CREATE OR REPLACE FUNCTION notify_clients_new_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Изпращаме уведомление само при INSERT (нова промоция)
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    -- Вмъкваме уведомление за всеки клиент
    INSERT INTO notifications (user_id, type, title, body, data, is_read)
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
    FROM profiles
    WHERE role = 'client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функция за изпращане на уведомления на всички клиенти при промяна в промоция
CREATE OR REPLACE FUNCTION notify_clients_promotion_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Изпращаме уведомление само при UPDATE и ако е активна
  IF TG_OP = 'UPDATE' AND NEW.is_active = true THEN
    -- Проверяваме дали има значима промяна (име, цена или описание)
    IF OLD.name != NEW.name OR
       OLD.price != NEW.price OR
       OLD.description != NEW.description OR
       OLD.duration_minutes != NEW.duration_minutes THEN

      -- Вмъкваме уведомление за всеки клиент
      INSERT INTO notifications (user_id, type, title, body, data, is_read)
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
      FROM profiles
      WHERE role = 'client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Изтриваме старите triggers ако съществуват
DROP TRIGGER IF EXISTS trigger_notify_new_service ON services;
DROP TRIGGER IF EXISTS trigger_notify_service_updated ON services;
DROP TRIGGER IF EXISTS trigger_notify_new_promotion ON promotions;
DROP TRIGGER IF EXISTS trigger_notify_promotion_updated ON promotions;

-- Създаваме trigger за нови услуги (AFTER INSERT)
CREATE TRIGGER trigger_notify_new_service
  AFTER INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_new_service();

-- Създаваме trigger за промени в услуги (AFTER UPDATE)
CREATE TRIGGER trigger_notify_service_updated
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_service_updated();

-- Създаваме trigger за нови промоции (AFTER INSERT)
CREATE TRIGGER trigger_notify_new_promotion
  AFTER INSERT ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_new_promotion();

-- Създаваме trigger за промени в промоции (AFTER UPDATE)
CREATE TRIGGER trigger_notify_promotion_updated
  AFTER UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_promotion_updated();
