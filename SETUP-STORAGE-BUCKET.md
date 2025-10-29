# Създаване на Storage Bucket за Промоции

## Проблем
След копиране на базата данни с "Restore to new project", Storage buckets НЕ са копирани автоматично.

## Решение

### Метод 1: SQL Editor (ПРЕПОРЪЧИТЕЛНО)

1. Отвори **SQL Editor** в Supabase Dashboard:
   https://supabase.com/dashboard/project/bkutgmdmnckvavkaljiz/sql/new

2. Копирай целия SQL код от файла `create-promotion-images-bucket.sql`

3. Кликни **"Run"** (или натисни `Ctrl + Enter`)

4. Трябва да видиш резултат показващ създадения bucket:
   ```
   id: promotion-images
   name: promotion-images
   public: true
   file_size_limit: 5242880
   allowed_mime_types: {image/png, image/jpeg, image/jpg, image/webp}
   ```

### Метод 2: Ръчно през Dashboard

1. Отвори **Storage** в Dashboard:
   https://supabase.com/dashboard/project/bkutgmdmnckvavkaljiz/storage/buckets

2. Кликни **"New bucket"**

3. Настройки:
   - **Name:** `promotion-images`
   - **Public bucket:** ✅ (отметнато)
   - **File size limit:** 5 MB
   - **Allowed MIME types:**
     - `image/png`
     - `image/jpeg`
     - `image/jpg`
     - `image/webp`

4. Кликни **"Create bucket"**

5. След създаване, отвори bucket-а и кликни **"Policies"**

6. Добави 4 policies (кликни "New policy" за всяка):

   **Policy 1: Public Read**
   - Policy name: `Public Access`
   - Allowed operation: `SELECT`
   - Target roles: `public` (по подразбиране)
   - USING expression: `true`

   **Policy 2: Upload**
   - Policy name: `Authenticated users can upload promotion images`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - WITH CHECK expression: `bucket_id = 'promotion-images'`

   **Policy 3: Update**
   - Policy name: `Authenticated users can update promotion images`
   - Allowed operation: `UPDATE`
   - Target roles: `authenticated`
   - USING expression: `bucket_id = 'promotion-images'`

   **Policy 4: Delete**
   - Policy name: `Authenticated users can delete promotion images`
   - Allowed operation: `DELETE`
   - Target roles: `authenticated`
   - USING expression: `bucket_id = 'promotion-images'`

## Проверка

След създаване на bucket-а, изпълни:

```bash
node check-storage.js
```

Трябва да видиш:

```
Found 1 storage bucket:

📦 Bucket: promotion-images
   Public: true
   Files: 0 (bucket is empty)
```

## Забележка за Gallery снимките

**Gallery снимките НЕ използват Storage bucket!**

Те се записват директно в базата данни като **base64** в колоната `gallery_photos.image_url`.

Затова НЕ е нужен `gallery` bucket и НЕ трябва да копираш снимки от старата база.
