/*
  # Add Gallery Likes and Comments System

  1. New Tables
    - `gallery_likes`
      - `id` (uuid, primary key)
      - `photo_id` (uuid, foreign key to gallery_photos)
      - `user_id` (uuid, foreign key to auth.users)
      - `is_like` (boolean) - true for like, false for dislike
      - `created_at` (timestamptz)
      - Unique constraint on (photo_id, user_id) - one reaction per user per photo
    
    - `gallery_comments`
      - `id` (uuid, primary key)
      - `photo_id` (uuid, foreign key to gallery_photos)
      - `user_id` (uuid, foreign key to auth.users)
      - `comment_text` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can create their own likes/comments
    - Users can read all likes/comments
    - Users can update/delete only their own likes/comments
    - Admins can delete any comment

  3. Indexes
    - Index on photo_id for efficient querying
    - Index on user_id for user activity tracking
*/

-- Create gallery_likes table
CREATE TABLE IF NOT EXISTS gallery_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

-- Create gallery_comments table
CREATE TABLE IF NOT EXISTS gallery_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES gallery_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gallery_likes_photo_id ON gallery_likes(photo_id);
CREATE INDEX IF NOT EXISTS idx_gallery_likes_user_id ON gallery_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_comments_photo_id ON gallery_comments(photo_id);
CREATE INDEX IF NOT EXISTS idx_gallery_comments_user_id ON gallery_comments(user_id);

-- Enable RLS
ALTER TABLE gallery_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gallery_likes
CREATE POLICY "Users can view all likes"
  ON gallery_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own likes"
  ON gallery_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own likes"
  ON gallery_likes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON gallery_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for gallery_comments
CREATE POLICY "Users can view all comments"
  ON gallery_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own comments"
  ON gallery_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON gallery_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON gallery_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment"
  ON gallery_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gallery_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_gallery_comments_updated_at ON gallery_comments;
CREATE TRIGGER update_gallery_comments_updated_at
  BEFORE UPDATE ON gallery_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_gallery_comment_updated_at();

-- Function to create notification when photo is uploaded
CREATE OR REPLACE FUNCTION notify_clients_on_photo_upload()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create notifications for all clients
  INSERT INTO notifications (user_id, type, title, body)
  SELECT 
    id,
    'gallery_update',
    'Нова снимка в галерията',
    'Прегледайте новата снимка в галерията на салона'
  FROM profiles
  WHERE role = 'client';
  
  RETURN NEW;
END;
$$;

-- Trigger to notify clients when admin uploads photo
DROP TRIGGER IF EXISTS trigger_notify_photo_upload ON gallery_photos;
CREATE TRIGGER trigger_notify_photo_upload
  AFTER INSERT ON gallery_photos
  FOR EACH ROW
  EXECUTE FUNCTION notify_clients_on_photo_upload();
