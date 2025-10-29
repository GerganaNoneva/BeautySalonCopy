-- Sync notifications when a message is marked as read
-- This function marks any notification that references the message_id in its JSON `data`
-- as read when the corresponding message's read_at changes from NULL to a timestamp.

CREATE OR REPLACE FUNCTION public.sync_notifications_on_message_read()
RETURNS trigger AS $$
BEGIN
  -- Only act when read_at changed from NULL to NOT NULL
  IF (TG_OP = 'UPDATE') AND (NEW.read_at IS NOT NULL) AND (OLD.read_at IS NULL) THEN
    -- Update notifications that reference this message_id in their data JSON
    UPDATE public.notifications
    SET is_read = true
    WHERE (data->>'message_id') = NEW.id::text
      AND is_read IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_sync_notifications_on_message_read ON public.messages;
CREATE TRIGGER trigger_sync_notifications_on_message_read
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  WHEN (OLD.read_at IS NULL AND NEW.read_at IS NOT NULL)
  EXECUTE FUNCTION public.sync_notifications_on_message_read();

-- Note: consider adding SECURITY DEFINER or adjusting owner if your DB user requires elevated permissions.
