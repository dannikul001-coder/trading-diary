-- Trading Diary v12: balance top-ups + safe multi-page cloud sync support
-- Run this once in Supabase SQL Editor on the existing project.

create table if not exists public.balance_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_date date not null,
  operation_time time default '00:00',
  amount numeric(18,2) not null check (amount > 0),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.balance_operations enable row level security;

-- Safe to run if the policy already exists only after dropping the old name.
drop policy if exists "balance_operations_select_own" on public.balance_operations;
drop policy if exists "balance_operations_insert_own" on public.balance_operations;
drop policy if exists "balance_operations_update_own" on public.balance_operations;
drop policy if exists "balance_operations_delete_own" on public.balance_operations;

create policy "balance_operations_select_own"
on public.balance_operations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "balance_operations_insert_own"
on public.balance_operations for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "balance_operations_update_own"
on public.balance_operations for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "balance_operations_delete_own"
on public.balance_operations for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists balance_operations_user_date_idx
  on public.balance_operations(user_id, operation_date, operation_time);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists balance_operations_set_updated_at on public.balance_operations;
create trigger balance_operations_set_updated_at
before update on public.balance_operations
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
