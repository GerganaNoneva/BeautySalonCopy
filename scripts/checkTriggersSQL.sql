-- Check all triggers on messages table
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  proname as function_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'messages'::regclass
AND tgname NOT LIKE 'RI_%'
AND tgname NOT LIKE 'pg_%'
ORDER BY tgname;
