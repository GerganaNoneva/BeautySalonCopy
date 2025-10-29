/*
  # Update Salon Info Working Hours

  1. Changes
    - Add individual day working hours columns
    - Keep backward compatibility with working_hours text field
    - Add day-specific opening/closing times

  2. New Columns
    - monday_open, monday_close
    - tuesday_open, tuesday_close
    - wednesday_open, wednesday_close
    - thursday_open, thursday_close
    - friday_open, friday_close
    - saturday_open, saturday_close
    - sunday_open, sunday_close
    - Each day has is_open boolean flag
*/

-- Add day-specific working hours
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS monday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS monday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS monday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS tuesday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS tuesday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS tuesday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS wednesday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS wednesday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS wednesday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS thursday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS thursday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS thursday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS friday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS friday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS friday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS saturday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS saturday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS saturday_is_open boolean DEFAULT true;

ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS sunday_open text DEFAULT '09:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS sunday_close text DEFAULT '21:00';
ALTER TABLE salon_info ADD COLUMN IF NOT EXISTS sunday_is_open boolean DEFAULT true;
