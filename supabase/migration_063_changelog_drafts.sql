-- ============================================================
-- Migration: Changelog draft/publish control for admins.
--
-- Adds a real published state instead of every entry going live the
-- instant it's created. Defaults to true so nothing already written
-- by migration_062's seed script (or any entry created before this
-- migration runs) silently disappears — this is additive, not a
-- behavior change for existing content. Going forward, the admin
-- panel's create form defaults new entries to draft, with an
-- explicit toggle to publish or unpublish any entry at any time.
--
-- The "Anyone can view" policy from migration_062 is replaced with
-- one that actually enforces published = true at the database level
-- — not just filtered in application code, which a direct API call
-- could otherwise bypass. Admin access to drafts goes through the
-- service-role client in app/api/admin/changelog/route.js, which
-- bypasses RLS entirely, the same pattern this project already uses
-- for every other admin write.
--
-- Run this once in Supabase SQL Editor after migration_062.
-- ============================================================

alter table public.changelog_entries add column if not exists published boolean not null default true;

drop policy if exists "Anyone can view changelog entries" on public.changelog_entries;

create policy "Anyone can view published changelog entries" on public.changelog_entries
  for select using (published = true);
