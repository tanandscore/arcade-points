-- ============================================================
-- Migration: Performance Monitoring Dashboard — one new table for
-- real client-collected Web Vitals, one aggregation RPC.
--
-- Applying the lesson from migration_047 proactively rather than
-- repeating the mistake: the read path aggregates in Postgres from
-- day one (performance_summary), never "fetch every row, average in
-- JavaScript" — this table gets one row per pageview per metric,
-- which grows the same way last_played did.
--
-- No RLS restriction on INSERT — performance telemetry needs to work
-- for signed-out visitors on the homepage too, not just logged-in
-- users, and it carries no sensitive data (a page path and a numeric
-- timing value). SELECT is restricted to admins, since aggregate
-- traffic patterns are still internal information. The admin
-- dashboard itself reads via the service client (bypassing RLS, same
-- pattern as adminOverview.js), so this policy specifically protects
-- against a regular signed-in user querying the raw table directly
-- from their own session.
-- Run this once in Supabase SQL Editor after migration_047.
-- ============================================================

create table if not exists public.performance_events (
  id bigint generated always as identity primary key,
  path text not null,
  metric text not null check (metric in ('lcp', 'cls', 'ttfb', 'fid', 'load_time', 'game_launch', 'resource_count')),
  value numeric not null check (value >= 0 and value < 600000), -- generous upper bound (10 minutes in ms) to reject obvious garbage/abuse without clipping legitimately slow real measurements
  created_at timestamptz not null default now()
);

alter table public.performance_events enable row level security;

create policy "Anyone can submit a performance event" on public.performance_events
  for insert with check (true);

create policy "Only admins can read performance events" on public.performance_events
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create index if not exists performance_events_created_at_idx on public.performance_events (created_at desc);
create index if not exists performance_events_metric_idx on public.performance_events (metric);

create or replace function public.performance_summary(since timestamptz default null)
returns table(path text, metric text, avg_value numeric, sample_count bigint)
language sql
stable
as $$
  select path, metric, avg(value) as avg_value, count(*) as sample_count
  from public.performance_events
  where since is null or created_at >= since
  group by path, metric;
$$;

grant execute on function public.performance_summary(timestamptz) to authenticated;
