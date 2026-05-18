create table if not exists public.api_tokens (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['transactions:read', 'transactions:write', 'categories:read', 'categories:write', 'charts:read'],
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);

create index if not exists idx_api_tokens_user_id on public.api_tokens(user_id);
create index if not exists idx_api_tokens_token_hash on public.api_tokens(token_hash);
create index if not exists idx_api_tokens_active on public.api_tokens(user_id, revoked_at);

alter table public.api_tokens enable row level security;

create policy "Users can view own api tokens"
on public.api_tokens
for select
using (auth.uid() = user_id);

create policy "Users can insert own api tokens"
on public.api_tokens
for insert
with check (auth.uid() = user_id);

create policy "Users can update own api tokens"
on public.api_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own api tokens"
on public.api_tokens
for delete
using (auth.uid() = user_id);
