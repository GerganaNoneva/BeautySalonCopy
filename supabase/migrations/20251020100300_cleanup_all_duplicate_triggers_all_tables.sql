/*
  # Cleanup ALL Duplicate Triggers - All Tables

  1. Problem
    - Duplicate triggers exist on multiple tables
    - Messages had on_message_insert_notify duplicate
    - Appointment_requests may have duplicate notification triggers
    - Appointments may have duplicate notification triggers

  2. Solution
    - Drop ALL custom triggers on ALL tables
    - Recreate ONLY necessary triggers with proper definitions
    - Ensure each notification type has exactly ONE trigger

  3. Tables to clean
    - messages
    - notifications
    - appointment_requests
    - appointments
*/

-- ==========================================
-- STEP 1: Drop ALL custom triggers on messages
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '=== Cleaning messages table ===';
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'messages'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON messages CASCADE', trigger_record.tgname);
    RAISE NOTICE 'Dropped: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 2: Drop ALL custom triggers on notifications
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '=== Cleaning notifications table ===';
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'notifications'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON notifications CASCADE', trigger_record.tgname);
    RAISE NOTICE 'Dropped: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 3: Drop ALL custom triggers on appointment_requests
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '=== Cleaning appointment_requests table ===';
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'appointment_requests'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON appointment_requests CASCADE', trigger_record.tgname);
    RAISE NOTICE 'Dropped: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 4: Drop ALL custom triggers on appointments
-- ==========================================

DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '=== Cleaning appointments table ===';
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'appointments'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON appointments CASCADE', trigger_record.tgname);
    RAISE NOTICE 'Dropped: %', trigger_record.tgname;
  END LOOP;
END $$;

-- ==========================================
-- STEP 5: Recreate ONLY necessary triggers
-- ==========================================

DO $$ BEGIN RAISE NOTICE '=== Recreating necessary triggers ==='; END $$;

-- Messages triggers (3 total)
CREATE TRIGGER trigger_notify_admin_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_message();

CREATE TRIGGER trigger_notify_client_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_new_message();

CREATE TRIGGER update_conversation_timestamp_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Notifications triggers (1 total)
CREATE TRIGGER on_notification_insert
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_push_notification_on_insert();

-- Appointment requests triggers (1 total)
CREATE TRIGGER trigger_notify_admin_request
  AFTER INSERT ON appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_request();

-- Appointments triggers (1 total)
CREATE TRIGGER appointment_created_notification
  AFTER INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION notify_client_on_appointment_created();

-- ==========================================
-- STEP 6: Verify trigger counts
-- ==========================================

DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  RAISE NOTICE '=== Verification ===';

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'messages'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';
  RAISE NOTICE 'Messages triggers: % (expected: 3)', trigger_count;

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'notifications'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';
  RAISE NOTICE 'Notifications triggers: % (expected: 1)', trigger_count;

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'appointment_requests'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';
  RAISE NOTICE 'Appointment_requests triggers: % (expected: 1)', trigger_count;

  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'appointments'::regclass
  AND tgname NOT LIKE 'RI_%'
  AND tgname NOT LIKE 'pg_%';
  RAISE NOTICE 'Appointments triggers: % (expected: 1)', trigger_count;
END $$;
