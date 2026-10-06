-- V36: persist quiz attempts and make the passed state visible in lessons.
begin;

alter table public.learning_progress
  add column if not exists quiz_score numeric(5,2);

create table if not exists public.learning_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  score numeric(5,2) not null default 0,
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_quiz_attempts_user_lesson_idx
  on public.learning_quiz_attempts(user_id, lesson_id, created_at desc);

alter table public.learning_quiz_attempts enable row level security;

drop policy if exists "Users can read own quiz attempts" on public.learning_quiz_attempts;
create policy "Users can read own quiz attempts"
  on public.learning_quiz_attempts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own quiz attempts" on public.learning_quiz_attempts;
create policy "Users can insert own quiz attempts"
  on public.learning_quiz_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

commit;
