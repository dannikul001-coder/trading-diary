-- Trading Diary: схема для многопользовательской версии.
-- ВАЖНО: этот файл должен соответствовать структуре, которую используем в Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text default 'USD',
  timezone text default 'UTC',
  date_format text default 'DD.MM.YYYY',
  theme text default 'dark',
  starting_balance numeric(18,2) default 0,
  appearance jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_trade_id text,
  sync_key text,
  deleted_at timestamptz,
  trade_date date not null,
  close_trade_date date,
  close_trade_time time,
  open_price numeric(24,10),
  close_price numeric(24,10),
  source_currency text,
  trade_time time,
  instrument text not null,
  instrument_category text default 'Custom',
  direction text default 'CALL',
  expiration text,
  stake numeric(18,2) not null,
  payout numeric(7,2) not null,
  result text not null,
  pnl numeric(18,2) generated always as (
    case
      when result = 'win' then round(stake * payout / 100, 2)
      when result = 'loss' then -stake
      else 0
    end
  ) stored,
  strategy text,
  account text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date default current_date,
  deleted_at timestamptz,
  title text,
  content text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date default current_date,
  period text not null default 'today',
  deleted_at timestamptz,
  task text not null,
  done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journal_date date default current_date,
  text text,
  worked text,
  failed text,
  lesson text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text,
  title text,
  target numeric,
  current_value numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.main_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title text default 'Главная цель',
  target_balance numeric(18,2),
  target_pnl numeric(18,2),
  target_win_rate numeric(7,2),
  target_trades integer,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  symbol text,
  category text default 'Custom',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.trades enable row level security;
alter table public.notes enable row level security;
alter table public.plans enable row level security;
alter table public.journals enable row level security;
alter table public.goals enable row level security;
alter table public.main_goals enable row level security;
alter table public.instruments enable row level security;
alter table public.strategies enable row level security;
alter table public.balance_operations enable row level security;

-- Policies are intentionally omitted here because the production database
-- already has them. This file documents the target schema; do not re-run it
-- blindly against a live database.

create index if not exists trades_user_external_trade_id_idx on public.trades(user_id, external_trade_id);
create index if not exists balance_operations_user_date_idx on public.balance_operations(user_id, operation_date, operation_time);
