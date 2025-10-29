/*
  # Add unregistered clients support

  1. New Tables
    - `unregistered_clients`
      - `id` (uuid, primary key) - Unique identifier
      - `full_name` (text) - Client's full name
      - `phone` (text, nullable) - Client's phone number
      - `email` (text, nullable) - Client's email address (optional)
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz) - When created
      - `created_by` (uuid) - Admin who created this (references profiles)

  2. Changes
    - Add `unregistered_client_id` column to `appointments` table
    - Keep `client_id` for registered users from profiles
    - One appointment must have EITHER client_id OR unregistered_client_id

  3. Security
    - Enable RLS on `unregistered_clients` table
    - Only admins can access unregistered_clients table
*/

-- Create unregistered_clients table
CREATE TABLE IF NOT EXISTS unregistered_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Add unregistered_client_id to appointments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'unregistered_client_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN unregistered_client_id uuid REFERENCES unregistered_clients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make client_id nullable (was NOT NULL before)
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;

-- Add constraint: must have either client_id or unregistered_client_id, not both
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_registered_or_unregistered_check'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_registered_or_unregistered_check
    CHECK (
      (client_id IS NOT NULL AND unregistered_client_id IS NULL) OR
      (client_id IS NULL AND unregistered_client_id IS NOT NULL)
    );
  END IF;
END $$;

-- Enable RLS
ALTER TABLE unregistered_clients ENABLE ROW LEVEL SECURITY;

-- Admins can view all unregistered clients
CREATE POLICY "Admins can view all unregistered clients"
  ON unregistered_clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can create unregistered clients
CREATE POLICY "Admins can create unregistered clients"
  ON unregistered_clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update unregistered clients
CREATE POLICY "Admins can update unregistered clients"
  ON unregistered_clients FOR UPDATE
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

-- Admins can delete unregistered clients
CREATE POLICY "Admins can delete unregistered clients"
  ON unregistered_clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
