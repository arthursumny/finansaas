alter table public.transactions
  add column if not exists is_subscription boolean not null default false,
  add column if not exists subscription_day smallint;

alter table public.transactions
  add constraint transactions_subscription_day_range
  check (subscription_day is null or subscription_day between 1 and 31);
