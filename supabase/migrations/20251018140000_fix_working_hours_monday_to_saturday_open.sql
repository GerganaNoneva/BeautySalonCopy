/*
  # Fix Working Hours - Ensure Monday to Saturday are Open

  1. Changes
    - Update working_hours_json to ensure Monday-Saturday are open (closed: false)
    - Keep Sunday as closed day (closed: true)
    - Set standard working hours: Mon-Fri 09:00-18:00, Sat 10:00-16:00

  2. Security
    - No changes to security policies
*/

-- Update working_hours_json to ensure correct open/closed status
UPDATE salon_info
SET working_hours_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              working_hours_json,
              '{monday}',
              '{"start": "09:00", "end": "18:00", "closed": false}'::jsonb
            ),
            '{tuesday}',
            '{"start": "09:00", "end": "18:00", "closed": false}'::jsonb
          ),
          '{wednesday}',
          '{"start": "09:00", "end": "18:00", "closed": false}'::jsonb
        ),
        '{thursday}',
        '{"start": "09:00", "end": "18:00", "closed": false}'::jsonb
      ),
      '{friday}',
      '{"start": "09:00", "end": "18:00", "closed": false}'::jsonb
    ),
    '{saturday}',
    '{"start": "10:00", "end": "16:00", "closed": false}'::jsonb
  ),
  '{sunday}',
  '{"start": "00:00", "end": "00:00", "closed": true}'::jsonb
)
WHERE id IS NOT NULL;
