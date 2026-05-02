alter table public.backtests
add column if not exists news text,
add column if not exists note text;
