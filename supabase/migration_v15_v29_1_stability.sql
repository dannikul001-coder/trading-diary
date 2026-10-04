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
