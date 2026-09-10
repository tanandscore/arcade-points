-- ============================================================
-- Migration: database-driven games config + subscriptions
-- Run this once in Supabase SQL Editor after migration_001.
-- ============================================================

-- ------------------------------------------------------------
-- Games table: the single source of truth for what shows on the
-- site, and how each game is priced. Edit rows in this table
-- (Supabase Table Editor — no code, no GitHub upload) to:
--   - rename a game, change its tagline/icon/category
--   - flip access_type between 'free', 'onetime', 'subscription'
--   - change price_paise / price_display for a one-time game
--   - show/hide a game with is_active
--   - reorder games with sort_order
-- component_key must match an entry in components/games/GameComponents.js
-- — that part is the one thing that still needs code, since it's
-- actual gameplay logic, not configuration.
-- ------------------------------------------------------------
create table public.games (
  slug text primary key,
  name text not null,
  icon text not null,
  category text not null,
  accent_color text not null,
  tagline text not null,
  component_key text not null,
  access_type text not null default 'free' check (access_type in ('free', 'onetime', 'subscription')),
  price_paise integer,
  price_display text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

alter table public.games enable row level security;

-- Everyone can see the game list — that's what populates the site.
-- There is deliberately no insert/update/delete policy for regular
-- users: edits happen through the Supabase dashboard using your own
-- project-owner access, which isn't subject to these RLS policies.
create policy "games are viewable by everyone"
  on public.games for select using (true);

-- ------------------------------------------------------------
-- Subscriptions: one active "Premium Pass" per user unlocks every
-- game with access_type = 'subscription'. Kept up to date by
-- /api/razorpay/webhook as Razorpay charges (or fails to charge)
-- the monthly mandate automatically.
-- ------------------------------------------------------------
create table public.subscriptions (
  user_id uuid references auth.users on delete cascade primary key,
  status text not null check (status in ('active', 'past_due', 'cancelled')),
  razorpay_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

-- A user can check their own subscription status.
create policy "users can view their own subscription"
  on public.subscriptions for select using (auth.uid() = user_id);

-- NOTE: no insert/update policy for regular users, same reasoning as
-- purchases — only server code with the service role key (after
-- Razorpay confirms payment, or via the webhook on renewal/cancel)
-- is allowed to write here.

-- ------------------------------------------------------------
-- Seed data: your existing 14 games, plus 2 new subscription-only
-- "Premium" games. Safe to re-run (upserts on slug).
-- ------------------------------------------------------------
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, price_paise, price_display, sort_order, is_active)
values
  ('reflex', 'Reflex Tap', '⚡', 'Reflex', '#3ee6e0', 'Tap the instant it turns green.', 'reflex', 'free', null, null, 10, true),
  ('memory', 'Memory Match', '🧠', 'Puzzle', '#ff3ea5', 'Clear the board in the fewest moves.', 'memory', 'free', null, null, 20, true),
  ('math', 'Math Rush', '🔢', 'Reflex', '#ffb703', 'Solve as many as you can in 30s.', 'math', 'onetime', 14900, '₹149', 30, true),
  ('snake', 'Neon Snake', '🐍', 'Arcade', '#3ee6e0', 'Classic snake — eat, grow, don''t crash.', 'snake', 'free', null, null, 40, true),
  ('whackamole', 'Mole Rush', '🔨', 'Reflex', '#ff3ea5', 'Whack moles before they duck back down.', 'whackamole', 'free', null, null, 50, true),
  ('simonsays', 'Sequence', '🎹', 'Puzzle', '#ffb703', 'Repeat the growing pattern of lights.', 'simonsays', 'free', null, null, 60, true),
  ('typing', 'Typing Rush', '⌨️', 'Reflex', '#3ee6e0', 'Type the words before time runs out.', 'typing', 'free', null, null, 70, true),
  ('colormatch', 'Color Rush', '🎨', 'Reflex', '#ff3ea5', 'Tap only when the word matches its color.', 'colormatch', 'free', null, null, 80, true),
  ('numbermemory', 'Digit Span', '🔢', 'Puzzle', '#ffb703', 'Remember an ever-longer string of digits.', 'numbermemory', 'free', null, null, 90, true),
  ('tictactoe', 'Tic Tac Duel', '⭕', 'Strategy', '#3ee6e0', 'Beat the computer as fast as you can.', 'tictactoe', 'free', null, null, 100, true),
  ('wordscramble', 'Word Scramble', '🔤', 'Word', '#ff3ea5', 'Unscramble as many words as you can.', 'wordscramble', 'free', null, null, 110, true),
  ('trivia', 'Quick Trivia', '❓', 'Word', '#ffb703', 'Answer general-knowledge questions fast.', 'trivia', 'free', null, null, 120, true),
  ('lanedash', 'Lane Dash', '🏎️', 'Arcade', '#3ee6e0', 'Dodge traffic in an endless 3-lane sprint.', 'lanedash', 'free', null, null, 130, true),
  ('pixeljumper', 'Pixel Jumper', '🟩', 'Arcade', '#ff3ea5', 'Jump platform to platform, don''t fall.', 'pixeljumper', 'free', null, null, 140, true),
  ('empirecommand', 'Empire Command', '⚔️', 'Premium', '#ffb703', 'Command armies and conquer the map.', 'empirecommand', 'subscription', null, null, 150, true),
  ('turbocircuit', 'Turbo Circuit', '🏁', 'Premium', '#3ee6e0', 'Race the circuit, beat your lap time.', 'turbocircuit', 'subscription', null, null, 160, true)
on conflict (slug) do update set
  name = excluded.name,
  icon = excluded.icon,
  category = excluded.category,
  accent_color = excluded.accent_color,
  tagline = excluded.tagline,
  component_key = excluded.component_key,
  access_type = excluded.access_type,
  price_paise = excluded.price_paise,
  price_display = excluded.price_display,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
