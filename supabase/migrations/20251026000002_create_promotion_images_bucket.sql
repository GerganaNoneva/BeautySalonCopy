-- Create storage bucket for promotion images
INSERT INTO storage.buckets (id, name, public)
VALUES ('promotion-images', 'promotion-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to promotion images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotion-images');

-- Allow authenticated users to upload promotion images
CREATE POLICY "Authenticated users can upload promotion images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotion-images');

-- Allow authenticated users to update promotion images
CREATE POLICY "Authenticated users can update promotion images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promotion-images');

-- Allow authenticated users to delete promotion images
CREATE POLICY "Authenticated users can delete promotion images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promotion-images');
