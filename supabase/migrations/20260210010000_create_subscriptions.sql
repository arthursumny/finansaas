create table public.subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  description text not null,
  amount decimal(12,2) not null check (amount > 0),
  category text not null,
  status text not null check (status in ('paid', 'pending')),
  charge_day smallint not null check (charge_day between 1 and 31),
  is_active boolean not null default true,
  start_date date not null default current_date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  primary key (id)
);

alter table public.subscriptions enable row level security;

create policy "Users can manage own subscriptions"
on public.subscriptions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_subscriptions_updated_at
  before update on public.subscriptions
  for each row
  execute function public.update_updated_at_column();

create table public.subscription_tags (
  id uuid not null default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (id),
  unique(subscription_id, tag_id)
);

alter table public.subscription_tags enable row level security;

create policy "Users can manage own subscription tags"
on public.subscription_tags
for all
using (
  exists (
    select 1 from public.subscriptions
    where subscriptions.id = subscription_tags.subscription_id
    and subscriptions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.subscriptions
    where subscriptions.id = subscription_tags.subscription_id
    and subscriptions.user_id = auth.uid()
  )
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscription_tags_subscription_id on public.subscription_tags(subscription_id);
create index idx_subscription_tags_tag_id on public.subscription_tags(tag_id);

alter table public.transactions
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists idx_transactions_subscription_id on public.transactions(subscription_id);
create unique index if not exists idx_transactions_subscription_date
  on public.transactions(subscription_id, date)
  where subscription_id is not null;
