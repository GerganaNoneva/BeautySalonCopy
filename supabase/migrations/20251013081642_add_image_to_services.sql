/*
  # Add image support to services

  1. Changes
    - Add image_url column to services table for storing service images
    - Images will be stored in Supabase Storage or as URLs

  2. Notes
    - Existing services will have NULL image_url (optional field)
*/

ALTER TABLE services
ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_services_image_url ON services(image_url);
