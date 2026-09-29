-- Stage 2: Admin RBAC + Learning CMS
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

alter table public.user_roles enable row level security;
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table if not exists public.learning_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.learning_categories(id) on delete set null,
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  lesson_type text not null default 'article',
  cover_url text,
  duration_minutes int,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  content jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed')),
  progress int not null default 0 check (progress between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.learning_categories enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_progress enable row level security;

drop policy if exists "learning_categories_public_read" on public.learning_categories;
create policy "learning_categories_public_read" on public.learning_categories
for select to authenticated using (published = true or public.is_admin());
drop policy if exists "learning_categories_admin_write" on public.learning_categories;
create policy "learning_categories_admin_write" on public.learning_categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "learning_lessons_public_read" on public.learning_lessons;
create policy "learning_lessons_public_read" on public.learning_lessons
for select to authenticated using (status = 'published' or public.is_admin());
drop policy if exists "learning_lessons_admin_write" on public.learning_lessons;
create policy "learning_lessons_admin_write" on public.learning_lessons
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "learning_progress_own" on public.learning_progress;
create policy "learning_progress_own" on public.learning_progress
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  display_name text,
  avatar_url text,
  role text,
  trades_count bigint,
  pnl numeric,
  win_rate numeric,
  lessons_completed bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    p.display_name,
    p.avatar_url,
    coalesce(ur.role,'user') as role,
    coalesce(t.cnt,0) as trades_count,
    coalesce(t.pnl,0) as pnl,
    coalesce(t.win_rate,0) as win_rate,
    coalesce(lp.completed,0) as lessons_completed
  from auth.users u
  left join public.profiles p on p.id=u.id
  left join public.user_roles ur on ur.user_id=u.id
  left join lateral (
    select count(*) cnt,
           coalesce(sum(x.pnl),0) pnl,
           case when count(*) filter (where x.result in ('win','loss'))=0 then 0
                else round(100.0*count(*) filter (where x.result='win') / count(*) filter (where x.result in ('win','loss')),2) end win_rate
    from public.trades x where x.user_id=u.id and coalesce(x.deleted_at is null,true)
  ) t on true
  left join lateral (
    select count(*) completed from public.learning_progress x where x.user_id=u.id and x.status='completed'
  ) lp on true
  order by u.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

insert into public.learning_categories(slug,title,description,sort_order)
values
('basics','Основы','Базовые понятия и устройство рынка.',10),
('candles','Свечи и паттерны','Свечные модели и визуальные формации.',20),
('technical','Технический анализ','Структура, уровни и графический анализ.',30),
('indicators','Индикаторы','Индикаторы и правила их применения.',40),
('strategies','Стратегии','Торговые сценарии и playbook.',50),
('psychology','Психология','Дисциплина, эмоции и торговый процесс.',60),
('practice','Практика','Кейсы, задания и разборы.',70)
on conflict (slug) do nothing;

-- После создания нужного Auth-пользователя назначьте ему admin одной строкой:
-- insert into public.user_roles(user_id, role)
-- select id, 'admin' from auth.users where email = 'ВАШ_ADMIN_EMAIL'
-- on conflict (user_id) do update set role='admin';

notify pgrst, 'reload schema';
