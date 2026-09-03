-- ============================================================
-- Migration: Duskward — a single-player dark fantasy RPG, living
-- entirely inside tapandscore's existing architecture. Deploys and
-- runs exactly like every other game on the site — no new hosting,
-- no new accounts, nothing new to manage.
--
-- Unlike every other game here, Duskward needs a real persistent
-- character (level, gold, inventory, quests) that survives between
-- sessions, not just a single score submitted at game-over. That's
-- what this new table is for — everything else (RLS pattern, access
-- gating) follows the exact same conventions as the rest of the site.
-- Run this once in Supabase SQL Editor after migration_022.
--
-- Note: this migration only creates a NEW table and adds ONE row to
-- your existing games list — it does not touch scores, profiles,
-- subscriptions, or any other existing table or data. Nothing here
-- deletes anything.
-- ============================================================

create table if not exists public.rpg_characters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  level int not null default 1,
  xp int not null default 0,
  hp int not null default 30,
  max_hp int not null default 30,
  base_attack int not null default 5,
  base_defense int not null default 2,
  gold int not null default 20,
  equipped_weapon jsonb,
  equipped_armor jsonb,
  inventory jsonb not null default '[]'::jsonb,
  quests jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rpg_characters enable row level security;

create policy "Users can view own character" on public.rpg_characters
  for select using (auth.uid() = user_id);

create policy "Users can insert own character" on public.rpg_characters
  for insert with check (auth.uid() = user_id);

create policy "Users can update own character" on public.rpg_characters
  for update using (auth.uid() = user_id);

insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('duskward', 'Duskward', '🗡️', 'Legend Pass', '#7a1f2b', 'A dark fantasy RPG. Your character, your world, saved forever.', 'duskward', 'subscription', 'premium_plus', null, null, 210, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;
