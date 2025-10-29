/*
  # Enable Realtime for Gallery Photos

  1. Changes
    - Enable realtime publication for gallery_photos table
    - This allows clients to receive real-time updates when new photos are uploaded

  2. Purpose
    - Client gallery will auto-refresh when admin uploads new photos
    - No manual refresh needed
*/

-- Enable realtime for gallery_photos table
ALTER PUBLICATION supabase_realtime ADD TABLE gallery_photos;
