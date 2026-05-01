create table if not exists public.trading_pairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pair text not null,
  created_at timestamptz not null default now(),
  unique (user_id, pair)
);

alter table public.trading_pairs enable row level security;

create policy "Users can read their trading pairs"
on public.trading_pairs
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their trading pairs"
on public.trading_pairs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their trading pairs"
on public.trading_pairs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their trading pairs"
on public.trading_pairs
for delete
to authenticated
using (user_id = auth.uid());
