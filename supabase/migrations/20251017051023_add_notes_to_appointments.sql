/*
  # Add Notes Field to Appointments

  1. Changes
    - Add optional notes column to appointments table for admin to add description
    - Notes can be used to specify special requirements or additional information
*/

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_notes ON appointments(notes) WHERE notes IS NOT NULL;
