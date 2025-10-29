/*
  # Enable Realtime for conversations table

  This migration enables real-time subscriptions for conversations table.
  This is needed because MessageBadge query uses a join with conversations table.

  ## Changes
  1. Enable realtime publication for conversations table

  ## Why this is needed
  The MessageBadge component queries messages with a join to conversations table.
  To properly detect changes, conversations should also have realtime enabled.
*/

-- Enable realtime for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;