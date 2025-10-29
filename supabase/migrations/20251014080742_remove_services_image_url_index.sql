/*
  # Remove image_url index from services table

  1. Changes
    - Drop index idx_services_image_url
    - This index blocks Base64 images (8KB limit)
  
  2. Reason
    - PostgreSQL B-tree indexes have 8KB max row size
    - Base64 images exceed this limit
    - Index on text field with large data is not needed
*/

DROP INDEX IF EXISTS idx_services_image_url;
