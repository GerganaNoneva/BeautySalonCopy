/*
  # Add Admin INSERT Policy for Appointments

  1. Changes
    - Add INSERT policy for admin role to create appointments for any client
    - This allows admins to create appointments on behalf of clients
  
  2. Security
    - Only authenticated users with admin role can insert appointments for others
    - Clients can still only create appointments for themselves
*/

CREATE POLICY "Admin can create appointments for clients"
  ON appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );