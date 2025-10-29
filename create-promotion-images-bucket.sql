-- ============================================
-- CREATE PROMOTION-IMAGES STORAGE BUCKET
-- ============================================
-- Изпълни този SQL скрипт в Supabase Dashboard > SQL Editor
-- Dashboard URL: https://supabase.com/dashboard/project/bkutgmdmnckvavkaljiz/sql/new

-- 1. Create storage bucket for promotion images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promotion-images',
  'promotion-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 2. Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload promotion images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update promotion images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete promotion images" ON storage.objects;

-- 3. Allow public read access to promotion images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

-- 4. Allow authenticated users to upload promotion images
CREATE POLICY "Authenticated users can upload promotion images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotion-images');

-- 5. Allow authenticated users to update promotion images
CREATE POLICY "Authenticated users can update promotion images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promotion-images');

-- 6. Allow authenticated users to delete promotion images
CREATE POLICY "Authenticated users can delete promotion images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promotion-images');

-- Verify the bucket was created
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name = 'promotion-images';
