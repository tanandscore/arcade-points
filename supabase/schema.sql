-- ============================================================
-- Arcade Points — database schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query
-- Paste this whole file in and click "Run".
-- ============================================================

-- Public profile for every signed-up user (username shown on leaderboards)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  created_at timestamptz default now()
);

-- Best score per user per game
create table public.scores (
  user_id uuid references auth.users on delete cascade not null,
  game text not null check (game in ('reflex', 'memory', 'math')),
  score integer not null,
  updated_at timestamptz default now(),
  primary key (user_id, game)
);

-- Records which paid games a user has unlocked
create table public.purchases (
  user_id uuid references auth.users on delete cascade not null,
  game text not null,
  purchased_at timestamptz default now(),
  primary key (user_id, game)
);

-- ------------------------------------------------------------
-- Row Level Security: who can read/write what
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.scores enable row level security;
alter table public.purchases enable row level security;

-- Anyone (even logged out) can see display names — needed for public leaderboards
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Anyone can see scores — that's what makes the leaderboard public
create policy "scores are viewable by everyone"
  on public.scores for select using (true);

-- A user can only ever write their OWN score row, never someone else's
create policy "users can insert their own score"
  on public.scores for insert with check (auth.uid() = user_id);

create policy "users can update their own score"
  on public.scores for update using (auth.uid() = user_id);

-- Users can check which games they personally own
create policy "users can view their own purchases"
  on public.purchases for select using (auth.uid() = user_id);

-- NOTE: there is deliberately no INSERT policy for purchases for normal users.
-- Only the server (using the service role key, after Stripe confirms payment)
-- is allowed to grant a purchase. This is what stops someone from unlocking
-- a paid game for free by calling the API directly.

-- ------------------------------------------------------------
-- Auto-create a profile row the moment someone signs up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
