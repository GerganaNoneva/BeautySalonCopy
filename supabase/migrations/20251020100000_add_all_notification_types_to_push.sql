/*
  # Add All Notification Types to Push Notification Trigger

  1. Changes
    - Update push notification trigger to support all notification types
    - Add missing types: booking_confirmed, booking_cancelled, new_booking_request, new_photo, promotion

  2. Behavior
    - All notifications created in the notifications table will now trigger push notifications
    - Uses the title and body from the notification record directly
*/

-- Update the push notification function to support all notification types
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

  -- Use title and body from the notification record
  -- This allows each notification to have custom messaging
  v_title := COALESCE(NEW.title, 'Ново уведомление');
  v_body := COALESCE(NEW.body, NEW.message, '');

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

-- Trigger already exists from previous migration, no need to recreate
-- DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
-- CREATE TRIGGER on_notification_insert
--   AFTER INSERT ON notifications
--   FOR EACH ROW
--   EXECUTE FUNCTION send_push_notification_on_insert();
