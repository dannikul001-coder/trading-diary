-- Trading Diary V21: balance withdrawals / operation type
-- Run once after migration_v8_profile_deposits.sql. Safe for existing balance_operations rows.

alter table public.balance_operations
  add column if not exists operation_type text not null default 'deposit';

update public.balance_operations
set operation_type='deposit'
where operation_type is null or operation_type not in ('deposit','withdrawal');

alter table public.balance_operations
  drop constraint if exists balance_operations_operation_type_check;

alter table public.balance_operations
  add constraint balance_operations_operation_type_check
  check (operation_type in ('deposit','withdrawal'));

create index if not exists balance_operations_user_type_date_idx
  on public.balance_operations(user_id, operation_type, operation_date, operation_time);

notify pgrst, 'reload schema';
