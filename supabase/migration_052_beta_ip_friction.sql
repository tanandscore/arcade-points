-- ============================================================
-- Migration: Beta program duplicate-account friction.
--
-- Honest scope note: this cannot fully prevent a determined person
-- from creating multiple accounts for beta benefits — no web app can
-- do that without strong identity verification (phone OTP, ID
-- checks), which is out of scope here. What this DOES do: raise a
-- real, enforceable bar against the common case (someone signing up
-- again through the normal site) using Cloudflare's edge-verified
-- CF-Connecting-IP header, which the client cannot spoof — Cloudflare
-- overwrites it at their edge before the request ever reaches this
-- app, unlike a client-supplied header.
--
-- Enforcement happens in app/api/beta-ip-check/route.js, called by
-- the signup form right after a successful signup — if the same IP
-- already claimed a beta slot, that grant is immediately revoked and
-- the slot is returned to the pool for someone else. This is
-- deliberately NOT done inside the existing claim_beta_slot_for_
-- new_user() trigger, since a database trigger firing on auth.users
-- insert has no access to HTTP request context (no IP address) —
-- Supabase's signup endpoint is called directly by the browser, not
-- proxied through this app's own server.
-- Run this once in Supabase SQL Editor after migration_051.
-- ============================================================

create table if not exists public.beta_ip_claims (
  ip_address text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.beta_ip_claims enable row level security;
-- No policies for regular users — this table is only ever touched by
-- the service-role client from app/api/beta-ip-check/route.js, which
-- bypasses RLS entirely. Nothing client-side needs direct access.

-- Called when a duplicate-IP claim is caught and revoked — returns
-- the slot to the pool (bounded at 0, never negative) so a genuine
-- new signup can still claim it.
create or replace function public.release_beta_slot()
returns void as $$
begin
  update public.beta_program
  set slots_used = greatest(0, slots_used - 1)
  where id = 1;
end;
$$ language plpgsql security definer;

grant execute on function public.release_beta_slot() to authenticated;
