# V38 — Post images and material-specific content

## Fixed
- Admin lesson editor accepts multiple image files for a post/material (JPG, PNG, WEBP, GIF, AVIF; max 15 MB per image).
- Images upload to the existing Supabase Storage bucket `learning-assets/images/...`.
- Uploaded image URLs are saved in `learning_lessons.content.imageUrls` and rendered as a responsive gallery inside the published lesson.
- Existing `imageUrl` remains supported for a single external cover/image URL.
- Supabase bucket MIME allowlist includes image types. Re-run `supabase/learning_assets_storage.sql` in SQL Editor so an existing bucket's MIME allowlist is updated.
- Generic modal file control now supports selecting multiple files.

## Recommended content structure by material type
- Video: YouTube URL, duration, lesson explanation, key takeaways, practice, quiz.
- Post/article: title, rich/structured text, multiple images, captions/examples, key takeaways, optional practice/quiz.
- Audio: audio file/URL, title, short description/transcript, key takeaways, optional quiz.
- Book/document: file/URL, title, author/source, description, reading task, optional quiz.
- Practice/session: scenario, instructions, screenshots, learner answer/reflection.

Current V38 adds post image uploads and gallery rendering. The lesson editor still uses a shared form for all types; the next UI improvement would be conditional type-specific panels so irrelevant fields are hidden when a type is selected.

## Validation
- `node --check js/admin.js`
- `node --check js/app.js`
- Live upload/render requires deployment and the project's Supabase migration.
