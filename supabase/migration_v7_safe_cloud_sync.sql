-- TRADING DIARY — SAFE CLOUD SYNC
-- Run this file once in Supabase SQL Editor.
-- It is safe to run repeatedly because all changes use IF NOT EXISTS.

alter table public.trades
  add column if not exists sync_key text;

alter table public.trades
  add column if not exists deleted_at timestamptz;

-- Give any legacy rows a unique key so they remain addressable.
update public.trades
set sync_key = 'legacy:' || id::text
where sync_key is null or btrim(sync_key) = '';

create unique index if not exists trades_user_sync_key_uidx
  on public.trades(user_id, sync_key);

create index if not exists trades_user_sync_key_idx
  on public.trades(sync_key);

create index if not exists trades_user_deleted_at_idx
  on public.trades(user_id, deleted_at);

notify pgrst, 'reload schema';
