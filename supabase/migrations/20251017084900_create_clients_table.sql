/*
  # Create clients table for unregistered clients

  1. New Tables
    - `clients`
      - `id` (uuid, primary key) - Unique identifier for the client
      - `full_name` (text) - Client's full name
      - `phone` (text, nullable) - Client's phone number
      - `email` (text, nullable) - Client's email address (optional)
      - `notes` (text, nullable) - Additional notes about the client
      - `created_at` (timestamptz) - When the client was created
      - `created_by` (uuid) - Admin who created this client (references profiles)

  2. Changes
    - Add `client_id` column to `appointments` table to reference unregistered clients
    - Keep `user_id` in appointments for registered users
    - One appointment can have EITHER user_id OR client_id, not both

  3. Security
    - Enable RLS on `clients` table
    - Admins can view, create, update, and delete all clients
    - Regular users cannot access the clients table

  4. Notes
    - This table is for clients who don't have app accounts
    - They are created by admins for appointment management
    - No authentication required for these clients
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Add client_id to appointments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add constraint to ensure appointment has either client_id or unregistered_client_id, not both
-- This constraint is skipped if the columns don't exist (migration may be outdated)
DO $$
BEGIN
  -- Check if both columns exist before adding constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'client_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'unregistered_client_id'
  ) THEN
    -- Only add constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'appointments_client_or_unregistered_check'
    ) THEN
      ALTER TABLE appointments ADD CONSTRAINT appointments_client_or_unregistered_check
      CHECK (
        (client_id IS NOT NULL AND unregistered_client_id IS NULL) OR
        (client_id IS NULL AND unregistered_client_id IS NOT NULL)
      );
    END IF;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Admins can view all clients
CREATE POLICY "Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can create clients
CREATE POLICY "Admins can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update clients
CREATE POLICY "Admins can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete clients
CREATE POLICY "Admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update appointments policies to work with client_id
DROP POLICY IF EXISTS "Admins can view all appointments" ON appointments;
CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Clients view own appointments" ON appointments;

-- Only create this policy if client_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'client_id'
  ) THEN
    EXECUTE 'CREATE POLICY "Clients view own appointments"
      ON appointments FOR SELECT
      TO authenticated
      USING (auth.uid() = client_id)';
  END IF;
END $$;
