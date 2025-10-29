/*
  # Force Cleanup - Remove ALL Duplicate Triggers

  1. Problem
    - Even after previous migrations, duplicate triggers may still exist
    - Some triggers may have been created manually or through other means

  2. Solution
    - Drop EVERY SINGLE trigger on messages table (except system triggers)
    - Drop EVERY SINGLE trigger on notifications table (except system triggers)
    - Recreate ONLY the 3 necessary triggers with proper definitions

  3. Safety
    - We preserve system triggers (RI_%, pg_%)
    - We recreate all necessary triggers from scratch
*/

-- ==========================================
-- STEP 1: Nuclear option - Drop ALL custom triggers on messages
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'messages'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON messages', trigger_record.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 2: Drop ALL custom triggers on notifications
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'notifications'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON notifications', trigger_record.tgname);
    RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 3: Recreate ONLY necessary triggers
-- ==========================================

-- Trigger 1: Notify admin when client sends message
CREATE TRIGGER trigger_notify_admin_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_message();

-- Trigger 2: Notify client when admin sends message
CREATE TRIGGER trigger_notify_client_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_new_message();

-- Trigger 3: Update conversation timestamp
CREATE TRIGGER update_conversation_timestamp_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Trigger 4: Send push notification when notification is created
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();

-- ==========================================
-- STEP 4: Verify triggers
-- ==========================================

DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'messages'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';

  RAISE NOTICE 'Total triggers on messages table: %', trigger_count;

  IF trigger_count <> 3 THEN
    RAISE WARNING 'Expected 3 triggers on messages, but found %', trigger_count;
  END IF;

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'notifications'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';

  RAISE NOTICE 'Total triggers on notifications table: %', trigger_count;

  IF trigger_count <> 1 THEN
    RAISE WARNING 'Expected 1 trigger on notifications, but found %', trigger_count;
  END IF;
END $$;
