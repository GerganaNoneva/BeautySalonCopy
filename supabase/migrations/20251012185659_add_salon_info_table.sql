/*
  # Create salon_info table

  1. New Tables
    - `salon_info`
      - `id` (uuid, primary key)
      - `salon_name` (text) - Име на салона
      - `phone` (text) - Телефон за контакт
      - `address` (text) - Адрес
      - `google_maps_url` (text) - Google Maps линк
      - `instagram_url` (text) - Instagram профил
      - `facebook_url` (text) - Facebook профил
      - `tiktok_url` (text) - TikTok профил
      - `working_hours` (text) - Работно време
      - `updated_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `salon_info` table
    - Add policy for all authenticated users to read salon info
    - Add policy for admin users to update salon info

  3. Initial Data
    - Insert default salon information
*/

CREATE TABLE IF NOT EXISTS salon_info (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  salon_name text NOT NULL DEFAULT 'Urban Beauty Bar',
  phone text DEFAULT '',
  address text DEFAULT '',
  google_maps_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  working_hours text DEFAULT 'Понеделник - Неделя: 9:00 - 21:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE salon_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view salon info"
  ON salon_info
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update salon info"
  ON salon_info
  FOR UPDATE
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

CREATE POLICY "Only admins can insert salon info"
  ON salon_info
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO salon_info (salon_name, phone, address, working_hours)
VALUES ('Urban Beauty Bar', '+359 888 123 456', 'София, бул. Витоша 100', 'Понеделник - Неделя: 9:00 - 21:00')
ON CONFLICT (id) DO NOTHING;
