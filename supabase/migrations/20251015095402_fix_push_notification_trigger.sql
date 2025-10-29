/*
  # Fix Push Notification Trigger

  1. Changes
    - Fix HTTP request syntax to use proper extensions.http function
    - Simplify the function to work with Supabase environment
*/

-- Drop and recreate the function with correct syntax
DROP FUNCTION IF EXISTS send_push_notification_on_insert() CASCADE;

CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_push_token TEXT;
  v_title TEXT;
  v_body TEXT;
  v_function_url TEXT;
  v_http_response extensions.http_response;
BEGIN
  -- Get the user's push token
  SELECT push_token INTO v_push_token
  FROM profiles
  WHERE id = NEW.user_id;

  -- If no push token, exit early
  IF v_push_token IS NULL OR v_push_token = '' THEN
    RETURN NEW;
  END IF;

  -- Build notification title and body based on type
  CASE NEW.type
    WHEN 'new_message' THEN
      v_title := 'Ново съобщение';
      v_body := NEW.message;
    WHEN 'appointment_request' THEN
      v_title := 'Нова заявка за час';
      v_body := NEW.message;
    WHEN 'appointment_confirmed' THEN
      v_title := 'Потвърден час';
      v_body := NEW.message;
    WHEN 'appointment_cancelled' THEN
      v_title := 'Отказан час';
      v_body := NEW.message;
    WHEN 'new_gallery_item' THEN
      v_title := 'Нова снимка в галерията';
      v_body := NEW.message;
    WHEN 'gallery_comment' THEN
      v_title := 'Нов коментар';
      v_body := NEW.message;
    ELSE
      v_title := 'Ново уведомление';
      v_body := NEW.message;
  END CASE;

  -- Get Supabase URL from environment
  v_function_url := current_setting('app.settings.supabase_url', true);
  IF v_function_url IS NULL OR v_function_url = '' THEN
    -- Fallback for local development
    v_function_url := 'http://host.docker.internal:54321';
  END IF;
  
  v_function_url := v_function_url || '/functions/v1/send-push-notification';

  -- Call Edge Function to send push notification
  BEGIN
    SELECT * INTO v_http_response
    FROM extensions.http((
      'POST',
      v_function_url,
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true))
      ],
      'application/json',
      json_build_object(
        'to', v_push_token,
        'title', v_title,
        'body', v_body,
        'message_id', CASE WHEN NEW.type = 'new_message' THEN (NEW.data->>'message_id')::TEXT ELSE NULL END,
        'data', json_build_object(
          'notification_id', NEW.id,
          'type', NEW.type,
          'data', NEW.data
        )
      )::text
    ));
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();
