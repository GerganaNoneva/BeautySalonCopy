-- Add image_url column to promotions table
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN promotions.image_url IS 'URL to promotion image stored in Supabase Storage';
