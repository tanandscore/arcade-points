-- ============================================================
-- Migration: admin controls
--  * site_announcements: a banner shown to every visitor (promo, news, warning) with optional link and schedule.
--  * admin_audit_log: who changed what in the admin panel.
--  * profiles.is_suspended: block a player from submitting scores.
--  * feedback.status / admin_note: triage feedback (new, reviewed, resolved).
-- Safe to run more than once. Run once in the Supabase SQL Editor after migration_074.
-- ============================================================
create table if not exists public.site_announcements (
  id bigint generated always as identity primary key,
  message text not null,
  level text not null default 'info' check (level in ('info','promo','warning')),
  link_url text,
  link_label text,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.site_announcements enable row level security;
drop policy if exists "Anyone can read active announcements" on public.site_announcements;
create policy "Anyone can read active announcements" on public.site_announcements for select using (is_active = true);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid,
  admin_name text,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security; -- no policies: only the service role can read or write
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.profiles add column if not exists suspended_reason text;

alter table public.feedback add column if not exists status text not null default 'new';
alter table public.feedback add column if not exists admin_note text;
