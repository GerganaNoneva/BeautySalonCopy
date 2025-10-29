/*
  # Set Bulgaria/Sofia Timezone

  1. Configuration Changes
    - Set database timezone to 'Europe/Sofia' (UTC+2/UTC+3 with DST)
    - This ensures all timestamp operations use Bulgarian local time
    - Affects all timestamptz columns and time-based queries
  
  2. Notes
    - Europe/Sofia timezone automatically handles daylight saving time
    - Winter time: UTC+2 (EET - Eastern European Time)
    - Summer time: UTC+3 (EEST - Eastern European Summer Time)
    - All existing timestamps remain in UTC internally but display in Bulgarian time
*/

-- Set the database timezone to Bulgaria/Sofia
ALTER DATABASE postgres SET timezone TO 'Europe/Sofia';

-- Apply timezone setting to current session
SET timezone TO 'Europe/Sofia';
