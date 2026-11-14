-- Migration 082: remembers each subscription payment so the Account page can show a "Billing history".
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text,
  price_label text,          -- e.g. "$2 / month", taken from your own plan prices
  provider text not null default 'fungies',
  provider_payment_id text,  -- Fungies' own id for the payment; stops the same payment being listed twice
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists payment_history_provider_payment_uidx
  on public.payment_history (provider, provider_payment_id) where provider_payment_id is not null;
create index if not exists payment_history_user_idx on public.payment_history (user_id, paid_at desc);

alter table public.payment_history enable row level security;
drop policy if exists "Users read own payment history" on public.payment_history;
create policy "Users read own payment history" on public.payment_history for select using (auth.uid() = user_id);

-- Your one test payment so far, so the list isn't empty (skips itself if already there).
insert into public.payment_history (user_id, plan_id, price_label, provider, provider_payment_id, paid_at)
select 'c7035efd-f431-4011-84b4-e9c6d3b5e16c', 'premium', '$2 / month', 'fungies', 'manual-first-test', now()
where exists (select 1 from auth.users where id = 'c7035efd-f431-4011-84b4-e9c6d3b5e16c')
  and not exists (select 1 from public.payment_history where provider_payment_id = 'manual-first-test');
