/*
  # Add Push Notification Trigger

  1. New Functions
    - `send_push_notification_on_insert` - Trigger function that sends push notifications when a new notification is created
      - Checks if the user has a push token
      - Calls the send-push-notification Edge Function via HTTP
      - Handles errors gracefully without blocking the insert

  2. New Triggers
    - `on_notification_insert` - Fires after a new notification is inserted
      - Calls the send_push_notification_on_insert function
      - Sends push notification to the user's device

  3. Security
    - Function is SECURITY DEFINER to allow access to Edge Function
    - Proper error handling to prevent blocking notification creation
*/

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_push_notification_on_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_push_token TEXT;
  v_user_name TEXT;
  v_title TEXT;
  v_body TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_function_url TEXT;
  v_response TEXT;
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
      v_title := 'Нова съобщение';
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

  -- Get Supabase URL and construct function URL
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'http://localhost:54321';
  END IF;
  
  v_function_url := v_supabase_url || '/functions/v1/send-push-notification';

  -- Get service role key
  v_service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  -- Call Edge Function to send push notification
  BEGIN
    SELECT content INTO v_response
    FROM http((
      'POST',
      v_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || COALESCE(v_service_role_key, ''))
      ],
      'application/json',
      json_build_object(
        'to', v_push_token,
        'title', v_title,
        'body', v_body,
        'data', json_build_object(
          'notification_id', NEW.id,
          'type', NEW.type,
          'data', NEW.data
        )
      )::text
    )::http_request);
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger to send push notification on new notification
DROP TRIGGER IF EXISTS on_notification_insert ON notifications;
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();
