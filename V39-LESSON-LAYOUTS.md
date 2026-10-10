# V39 — Lesson layouts by material type

- Video lessons prioritize the embedded video, then supporting theory and practice.
- Audio lessons prioritize the audio player, followed by notes/transcript, supporting file, practice and quiz.
- File/book lessons prioritize the document card with open/download actions, followed by description and practice.
- Post/article lessons use an editorial layout: title, body text, inline-positioned image gallery within the post body, optional examples, then practice and quiz.
- Admin lesson editor keeps image upload support for multiple JPG/PNG/WEBP/GIF/AVIF files. New images are uploaded to Supabase Storage and saved to `content.imageUrls`.

## Deployment
Use the existing Supabase `learning-assets` bucket and apply `supabase/learning_assets_storage.sql` if not already applied. Upload the updated project files and hard-refresh the site to avoid cached JavaScript/CSS.
