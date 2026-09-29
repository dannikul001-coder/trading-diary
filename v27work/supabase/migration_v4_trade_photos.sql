-- Trading Diary 2.0 — v4
-- Optional screenshot/photo attachment for individual trades.
alter table public.trades add column if not exists photo_data text;
notify pgrst, 'reload schema';
