/*
  # Fix Notification Triggers RLS

  1. Changes
    - Drop existing INSERT policy that blocks triggers
    - Create new policy allowing authenticated users to insert notifications
    - This allows both admins AND triggers to create notifications
  
  2. Security
    - Still restricted to authenticated context
    - Triggers run with elevated privileges via SECURITY DEFINER functions
*/

-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admin can create notifications" ON notifications;

-- Create a more permissive policy that allows triggers to work
-- This works because trigger functions run with definer's privileges
CREATE POLICY "Allow system to create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);