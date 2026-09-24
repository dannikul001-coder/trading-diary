-- Trading Diary: базовая схема для многопользовательской версии.
-- Выполняйте в Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text default 'USD',
  timezone text default 'UTC',
  theme text default 'dark',
  starting_balance numeric(18,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  time time,
  instrument text not null,
  type text not null,
  expiration text,
  stake numeric(18,2) not null,
  payout numeric(7,2) not null,
  result text not null,
  pnl numeric(18,2) not null,
  strategy text,
  platform text,
  state text,
  note text,
  category text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.trades enable row level security;

create policy "profiles own select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "trades own select" on public.trades for select to authenticated using ((select auth.uid()) = user_id);
create policy "trades own insert" on public.trades for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "trades own update" on public.trades for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "trades own delete" on public.trades for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
