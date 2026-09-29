-- Trading Diary Stage 2 V27: compatibility for existing balance_operations tables.
-- Safe for existing data. Does not delete trades, users, or balance records.
alter table public.balance_operations
  add column if not exists operation_type text;

update public.balance_operations
set operation_type = 'deposit'
where operation_type is null or btrim(operation_type) = '';

alter table public.balance_operations
  alter column operation_type set default 'deposit';

alter table public.balance_operations
  alter column operation_type set not null;

alter table public.balance_operations drop constraint if exists balance_operations_operation_type_check;
alter table public.balance_operations
  add constraint balance_operations_operation_type_check
  check (operation_type in ('deposit','withdrawal'));

create index if not exists balance_operations_user_type_date_idx
  on public.balance_operations(user_id, operation_type, operation_date, operation_time);

notify pgrst, 'reload schema';
