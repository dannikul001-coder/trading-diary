-- Trading Diary: automated-signals mode. Additive migration: does not alter existing tables.
-- Apply in Supabase SQL Editor. All monetary values are numeric, never floating-point.
create table if not exists public.automated_diary_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  initial_balance numeric(24,6) not null default 0 check (initial_balance >= 0),
  currency text not null default 'USDT',
  timezone text not null default 'Europe/Moscow',
  duration_seconds integer not null default 60 check (duration_seconds > 0),
  stake_percent numeric(12,6) not null default 2 check (stake_percent >= 0),
  profit_percent numeric(12,6) not null default 40 check (profit_percent >= 0),
  signals_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.automated_diary_trades (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  stake numeric(24,6) not null check (stake > 0), payout numeric(24,6) check (payout >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now(), closed_at timestamptz,
  duration_seconds integer not null default 60 check (duration_seconds > 0), note text not null default '',
  created_at timestamptz not null default now(),
  check ((status='open' and payout is null and closed_at is null) or (status='closed' and payout is not null and closed_at is not null))
);
create table if not exists public.automated_diary_bonuses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Бонусный мешочек', amount numeric(20,4) not null check (amount >= 0),
  status text not null default 'received' check (status in ('received','pending','cancelled')),
  received_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.automated_diary_signals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, signal_type text not null default 'trade' check (signal_type in ('trade','bonus','other')),
  starts_at timestamptz not null, remind_minutes integer not null default 5 check (remind_minutes >= 0),
  enabled boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.automated_diary_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdrawal')), amount numeric(24,6) not null check (amount > 0),
  note text not null default '', created_at timestamptz not null default now()
);
create index if not exists automated_diary_trades_user_opened_idx on public.automated_diary_trades(user_id, opened_at desc);
create index if not exists automated_diary_bonuses_user_received_idx on public.automated_diary_bonuses(user_id, received_at desc);
create index if not exists automated_diary_signals_user_starts_idx on public.automated_diary_signals(user_id, starts_at);
create index if not exists automated_diary_ledger_user_created_idx on public.automated_diary_ledger(user_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['automated_diary_profiles','automated_diary_trades','automated_diary_bonuses','automated_diary_signals','automated_diary_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t||'_owner_all', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
