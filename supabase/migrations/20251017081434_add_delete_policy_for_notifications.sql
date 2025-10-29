/*
  # Add DELETE policy for notifications

  1. Changes
    - Add policy to allow users to delete their own notifications
    - Users can only delete notifications where they are the owner (user_id matches)

  2. Security
    - Users can only delete their own notifications
    - No one can delete other users' notifications
*/

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
