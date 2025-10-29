/*
  # Enable Realtime for gallery likes and comments

  1. Changes
    - Enable realtime publication for gallery_likes table
    - Enable realtime publication for gallery_comments table

  2. Why this is needed
    - Allows admin to see likes/dislikes in real-time as clients interact
    - Allows admin to see new comments instantly without refreshing
    - Provides live updates for engagement metrics

  3. Notes
    - Admin gallery screen will subscribe to these changes
    - Updates will be reflected immediately in the UI
*/

-- Enable realtime for gallery_likes table
ALTER PUBLICATION supabase_realtime ADD TABLE gallery_likes;

-- Enable realtime for gallery_comments table
ALTER PUBLICATION supabase_realtime ADD TABLE gallery_comments;
