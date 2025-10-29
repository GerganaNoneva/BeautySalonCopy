/*
  # Update salon_info table structure

  1. Changes
    - Add latitude and longitude columns for map coordinates
    - Change working_hours to JSONB for structured data (days of week with times)
    - Keep backward compatibility with text working_hours

  2. Structure
    - working_hours_json: {"monday": {"start": "09:00", "end": "18:00", "closed": false}, ...}
    - latitude, longitude: for map display
*/

-- Add new columns for map coordinates
ALTER TABLE salon_info 
ADD COLUMN IF NOT EXISTS latitude decimal(10, 8) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude decimal(11, 8) DEFAULT NULL;

-- Add JSONB column for structured working hours
ALTER TABLE salon_info
ADD COLUMN IF NOT EXISTS working_hours_json jsonb DEFAULT '{
  "monday": {"start": "09:00", "end": "18:00", "closed": false},
  "tuesday": {"start": "09:00", "end": "18:00", "closed": false},
  "wednesday": {"start": "09:00", "end": "18:00", "closed": false},
  "thursday": {"start": "09:00", "end": "18:00", "closed": false},
  "friday": {"start": "09:00", "end": "18:00", "closed": false},
  "saturday": {"start": "10:00", "end": "16:00", "closed": false},
  "sunday": {"start": "00:00", "end": "00:00", "closed": true}
}'::jsonb;
