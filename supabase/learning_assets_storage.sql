-- Хранилище файлов для аудио и книг в конструкторе обучения.
-- Запустить один раз в Supabase SQL Editor от имени владельца проекта.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-assets',
  'learning-assets',
  true,
  104857600,
  array[
    'audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav',
    'audio/ogg','audio/aac','audio/webm','application/pdf','application/epub+zip',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;

-- Публичное чтение нужно для встроенного HTML audio и открытия PDF.
-- Загружать, заменять и удалять файлы может только администратор приложения.
drop policy if exists "Learning assets public read" on storage.objects;
create policy "Learning assets public read"
on storage.objects for select
using (bucket_id = 'learning-assets');

drop policy if exists "Learning assets admin insert" on storage.objects;
create policy "Learning assets admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'learning-assets' and public.is_admin());

drop policy if exists "Learning assets admin update" on storage.objects;
create policy "Learning assets admin update"
on storage.objects for update to authenticated
using (bucket_id = 'learning-assets' and public.is_admin())
with check (bucket_id = 'learning-assets' and public.is_admin());

drop policy if exists "Learning assets admin delete" on storage.objects;
create policy "Learning assets admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'learning-assets' and public.is_admin());
