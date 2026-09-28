-- Trading Diary 2.0 migration
-- Run this once in Supabase SQL Editor before using cloud import/appearance sync.

alter table public.trades
  add column if not exists external_trade_id text;

create index if not exists trades_user_external_trade_id_idx
  on public.trades(user_id, external_trade_id);

alter table public.settings
  add column if not exists appearance jsonb not null default '{}'::jsonb;

comment on column public.trades.external_trade_id is 'Original trade identifier from broker/export file, used for safe re-import and merge.';
comment on column public.settings.appearance is 'Per-user UI appearance preferences for Trading Diary 2.0.';

alter table public.trades add column if not exists close_trade_date date;
alter table public.trades add column if not exists close_trade_time time;
alter table public.trades add column if not exists open_price numeric(24,10);
alter table public.trades add column if not exists close_price numeric(24,10);
alter table public.trades add column if not exists source_currency text;
