/*
  # Add Promotion Notification Type

  1. Changes
    - Adds 'promotion' to the list of valid notification types
    - Allows admins to send promotion notifications to clients
*/

-- The notification types are not enforced by a constraint in the database
-- They are managed by the application logic
-- This migration documents that 'promotion' is now a valid notification type