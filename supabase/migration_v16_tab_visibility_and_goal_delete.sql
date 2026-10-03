-- TRADING DIARY V29.1 — STABILITY
-- Run once in Supabase SQL Editor. Safe to rerun.

alter table public.plans
  add column if not exists period text not null default 'today';

alter table public.plans
  add column if not exists deleted_at timestamptz;

alter table public.notes
  add column if not exists deleted_at timestamptz;

create index if not exists plans_user_deleted_at_idx
  on public.plans(user_id, deleted_at);

create index if not exists notes_user_deleted_at_idx
  on public.notes(user_id, deleted_at);

create index if not exists trades_user_date_time_idx
  on public.trades(user_id, trade_date, trade_time);

create unique index if not exists trades_user_sync_key_uidx
  on public.trades(user_id, sync_key);

create index if not exists trades_user_sync_key_idx
  on public.trades(user_id, sync_key);

notify pgrst, 'reload schema';

-- TRADING DIARY V30 FOUNDATION
-- Global per-tab visibility controlled by admins.
create table if not exists public.app_visibility (
  id integer primary key default 1 check (id = 1),
  hidden_tabs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_visibility(id, hidden_tabs)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

alter table public.app_visibility enable row level security;

drop policy if exists app_visibility_read on public.app_visibility;
create policy app_visibility_read on public.app_visibility
  for select to authenticated using (true);

create or replace function public.admin_set_tab_visibility(tab_key text, is_hidden boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['dashboard','trades','calendar','statistics','charts','plan','playbook','goal','goals','journal','notes','psychology','import','settings','training'];
  next_hidden jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if not (tab_key = any(allowed)) then raise exception 'invalid tab'; end if;

  select case
    when is_hidden then
      (select jsonb_agg(x order by x) from (
        select distinct value as x
        from jsonb_array_elements_text(coalesce(hidden_tabs,'[]'::jsonb))
        union select tab_key
      ) q)
    else
      (select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from (
        select value as x
        from jsonb_array_elements_text(coalesce(hidden_tabs,'[]'::jsonb))
        where value <> tab_key
      ) q)
  end into next_hidden
  from public.app_visibility
  where id=1;

  update public.app_visibility
  set hidden_tabs=coalesce(next_hidden,'[]'::jsonb), updated_at=now()
  where id=1;

  return (select row_to_json(v)::jsonb from public.app_visibility v where id=1);
end;
$$;
grant execute on function public.admin_set_tab_visibility(text,boolean) to authenticated;

notify pgrst, 'reload schema';
