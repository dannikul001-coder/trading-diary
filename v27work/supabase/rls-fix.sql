-- Run this ONCE in Supabase SQL Editor for the live project.
-- It enforces that authenticated users can access only their own rows.

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

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','settings','trades','notes','plans','journals','goals','main_goals','instruments','strategies')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy profiles_own_data on public.profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy settings_own_data on public.settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy trades_own_data on public.trades for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notes_own_data on public.notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy plans_own_data on public.plans for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy journals_own_data on public.journals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy goals_own_data on public.goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy main_goals_own_data on public.main_goals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy instruments_own_data on public.instruments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy strategies_own_data on public.strategies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
