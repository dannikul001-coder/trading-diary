# V37 — Audio, books and posts in learning lessons

## What changed
- Admin lesson editor now supports an audio title, audio file upload, or external audio URL.
- Admin lesson editor now supports book/document title, description, file upload, or external URL.
- Uploaded files are stored in the Supabase Storage bucket `learning-assets`.
- Published lesson view renders an HTML audio player and book/document open/download links.
- Existing theory field remains the post/article editor; formatted line breaks are displayed in the lesson.
- Supported upload size: up to 100 MB. Audio: MP3, M4A, WAV, OGG, AAC, WebM. Documents: PDF, EPUB, DOC, DOCX.

## Required Supabase setup
1. Open Supabase Dashboard → SQL Editor.
2. Run `supabase/learning_assets_storage.sql` once.
3. Confirm the current administrator has `role = 'admin'` in `public.user_roles`.
4. Deploy the updated site files.

The bucket is configured as public so the built-in audio player and direct document links can work without expiring URLs. That means anyone who obtains a file URL may open it; do not upload materials that must be strictly private. The upload/update/delete policies are restricted to application admins.

## How to use
1. Open Admin → Обучение → Изменить or create a lesson.
2. For audio, enter a title and select an audio file, or paste a direct HTTPS audio URL.
3. For a book, enter its title/description and select a document, or paste a direct HTTPS file URL.
4. For a post, write the content in “Теория / содержимое поста”.
5. Save the lesson. Publish it for learners to see it.

The app and JS syntax were checked locally with `node --check`. A live Supabase upload/playback test cannot be performed from the archive alone; it requires running the SQL migration and deploying against the user's Supabase project.
