-- Trading Diary 02 V6: additive schedule statuses.
-- Review and run on a test Supabase project first. This file does not change RLS.

begin;

alter table public.automated_diary_signals
  add column if not exists status text not null default 'scheduled';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'automated_diary_signals_status_check'
      and conrelid = 'public.automated_diary_signals'::regclass
  ) then
    alter table public.automated_diary_signals
      add constraint automated_diary_signals_status_check
      check (status in ('scheduled', 'completed', 'skipped'));
  end if;
end $$;

create index if not exists automated_diary_signals_user_status_starts_idx
  on public.automated_diary_signals(user_id, status, starts_at);

create or replace function public.ad_set_signal_status_v6(p_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_status not in ('scheduled','completed','skipped') then
    raise exception 'Unsupported signal status';
  end if;
  update public.automated_diary_signals
     set status = p_status
   where user_id = auth.uid() and id = any(p_ids);
  get diagnostics changed = row_count;
  if p_status <> 'scheduled' then
    delete from public.automated_diary_email_queue
     where user_id = auth.uid() and signal_id = any(p_ids)
       and status in ('pending','processing','failed');
  end if;
  return changed;
end $$;

revoke all on function public.ad_set_signal_status_v6(uuid[],text) from public, anon;
grant execute on function public.ad_set_signal_status_v6(uuid[],text) to authenticated;

create or replace function public.ad_claim_email_v4(p_limit integer default 30)
returns table(queue_id uuid,recipient text,signal_title text,signal_starts_at timestamptz,timezone text)
language plpgsql security definer set search_path='' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service only'; end if;
  insert into public.automated_diary_email_queue(user_id,signal_id,starts_at,remind_minutes)
  select s.user_id,s.id,s.starts_at,s.remind_minutes from public.automated_diary_signals s
  join public.automated_diary_profiles p on p.user_id=s.user_id
  join auth.users verified_user on verified_user.id=s.user_id and verified_user.email_confirmed_at is not null
  where s.enabled and s.status='scheduled' and p.signals_enabled and p.email_notifications_enabled
    and s.starts_at > now()-interval '5 minutes'
    and (s.starts_at-s.remind_minutes*interval '1 minute')<=now()
  on conflict do nothing;
  return query
  with claimed as (
    select q.id from public.automated_diary_email_queue q
    join public.automated_diary_signals candidate on candidate.id=q.signal_id and candidate.status='scheduled'
    where (q.status='pending' or (q.status='processing' and q.locked_at<now()-interval '10 minutes') or
      (q.status='failed' and q.attempts<3 and q.updated_at<now()-interval '3 minutes'))
    order by q.updated_at for update of q skip locked limit least(greatest(p_limit,1),100)
  ), changed as (
    update public.automated_diary_email_queue q set status='processing',attempts=q.attempts+1,locked_at=now(),updated_at=now()
    where q.id in (select id from claimed) returning q.*
  )
  select c.id,u.email::text,s.title::text,s.starts_at,p.timezone::text from changed c
  join public.automated_diary_signals s on s.id=c.signal_id and s.starts_at=c.starts_at and s.remind_minutes=c.remind_minutes
  join public.automated_diary_profiles p on p.user_id=c.user_id
  join auth.users u on u.id=c.user_id
  where s.enabled and s.status='scheduled' and p.email_notifications_enabled and p.signals_enabled and u.email is not null;
end $$;

commit;
