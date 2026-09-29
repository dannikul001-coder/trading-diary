-- V28: per-user currency visibility and currency-aware balance operations.
alter table public.balance_operations add column if not exists currency text;
alter table public.balance_operations add column if not exists base_amount numeric(18,2);
alter table public.balance_operations add column if not exists base_currency text;
update public.balance_operations bo set currency=coalesce(nullif(bo.currency,''),s.currency,'USD'), base_currency=coalesce(nullif(bo.base_currency,''),s.currency,'USD'), base_amount=coalesce(bo.base_amount,bo.amount) from public.settings s where s.user_id=bo.user_id;
alter table public.balance_operations alter column currency set default 'USD';
alter table public.balance_operations alter column base_currency set default 'USD';
alter table public.balance_operations alter column base_amount set default 0;
create index if not exists balance_operations_user_currency_idx on public.balance_operations(user_id,currency);

-- Existing RPC return types must be dropped before changing OUT columns.
drop function if exists public.admin_list_users();
drop function if exists public.admin_user_detail(uuid);

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz,
  display_name text, avatar_url text, role text, currency text,
  trades_count bigint, pnl numeric, win_rate numeric,
  deposits numeric, withdrawals numeric, current_balance numeric,
  lessons_completed bigint, last_trade_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'not authorized'; end if;
 return query
 select u.id,u.email::text,u.created_at,u.last_sign_in_at,p.display_name,p.avatar_url,coalesce(ur.role,'user'),coalesce(s.currency,'USD'),
 coalesce(t.cnt,0),coalesce(t.pnl,0),coalesce(t.win_rate,0),coalesce(b.deposits,0),coalesce(b.withdrawals,0),
 coalesce(s.starting_balance,0)+coalesce(b.deposits,0)-coalesce(b.withdrawals,0)+coalesce(t.pnl,0),coalesce(lp.completed,0),t.last_trade_at
 from auth.users u
 left join public.profiles p on p.id=u.id
 left join public.user_roles ur on ur.user_id=u.id
 left join public.settings s on s.user_id=u.id
 left join lateral (select count(*) cnt,coalesce(sum(x.pnl),0) pnl,case when count(*) filter(where x.result in('win','loss'))=0 then 0 else round(100.0*count(*) filter(where x.result='win')/count(*) filter(where x.result in('win','loss')),2) end win_rate,max((x.trade_date::text||' '||coalesce(x.trade_time::text,'00:00'))::timestamptz) last_trade_at from public.trades x where x.user_id=u.id and x.deleted_at is null) t on true
 left join lateral (select coalesce(sum(case when bo.operation_type='deposit' then coalesce(bo.base_amount,bo.amount) else 0 end),0) deposits,coalesce(sum(case when bo.operation_type='withdrawal' then coalesce(bo.base_amount,bo.amount) else 0 end),0) withdrawals from public.balance_operations bo where bo.user_id=u.id) b on true
 left join lateral (select count(*) completed from public.learning_progress x where x.user_id=u.id and x.status='completed') lp on true
 order by u.created_at desc;
end; $$;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_user_detail(target_user uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'not authorized'; end if;
 select jsonb_build_object(
 'user',jsonb_build_object('id',u.id,'email',u.email,'created_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'display_name',p.display_name,'avatar_url',p.avatar_url,'role',coalesce(ur.role,'user'),'currency',coalesce(s.currency,'USD')),
 'summary',jsonb_build_object('trades',coalesce(t.cnt,0),'pnl',coalesce(t.pnl,0),'win_rate',coalesce(t.win_rate,0),'deposits',coalesce(b.deposits,0),'withdrawals',coalesce(b.withdrawals,0),'starting_balance',coalesce(s.starting_balance,0),'current_balance',coalesce(s.starting_balance,0)+coalesce(b.deposits,0)-coalesce(b.withdrawals,0)+coalesce(t.pnl,0),'lessons_completed',coalesce(lp.completed,0),'currency',coalesce(s.currency,'USD')),
 'trades',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'date',x.trade_date,'time',x.trade_time,'instrument',x.instrument,'result',x.result,'pnl',x.pnl,'stake',x.stake,'currency',coalesce(x.source_currency,s.currency,'USD')) order by x.trade_date desc,x.trade_time desc) from (select * from public.trades where user_id=target_user and deleted_at is null order by trade_date desc,trade_time desc limit 20) x),'[]'::jsonb),
 'operations',coalesce((select jsonb_agg(jsonb_build_object('id',bo.id,'date',bo.operation_date,'time',bo.operation_time,'type',bo.operation_type,'amount',bo.amount,'currency',coalesce(bo.currency,s.currency,'USD'),'base_amount',coalesce(bo.base_amount,bo.amount),'base_currency',coalesce(bo.base_currency,s.currency,'USD'),'note',bo.note) order by bo.operation_date desc,bo.operation_time desc) from (select * from public.balance_operations where user_id=target_user order by operation_date desc,operation_time desc limit 20) bo),'[]'::jsonb)
 ) into result
 from auth.users u left join public.profiles p on p.id=u.id left join public.user_roles ur on ur.user_id=u.id left join public.settings s on s.user_id=u.id
 left join lateral (select count(*) cnt,coalesce(sum(x.pnl),0) pnl,case when count(*) filter(where x.result in('win','loss'))=0 then 0 else round(100.0*count(*) filter(where x.result='win')/count(*) filter(where x.result in('win','loss')),2) end win_rate from public.trades x where x.user_id=u.id and x.deleted_at is null) t on true
 left join lateral (select coalesce(sum(case when operation_type='deposit' then amount else 0 end),0) deposits,coalesce(sum(case when operation_type='withdrawal' then amount else 0 end),0) withdrawals from public.balance_operations where user_id=u.id) b on true
 left join lateral (select count(*) completed from public.learning_progress where user_id=u.id and status='completed') lp on true where u.id=target_user;
 return result;
end; $$;
grant execute on function public.admin_user_detail(uuid) to authenticated;
notify pgrst,'reload schema';
