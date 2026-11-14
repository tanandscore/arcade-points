-- ============================================================
-- Migration 085: privacy & data-retention clean-up.
--
-- 1. Network addresses (IPs) are no longer stored readable. The app now saves a one-way scrambled fingerprint instead
--    (app/api/beta-ip-check/route.js). Old rows hold readable addresses, so they are removed here (a readable address
--    always contains a dot or a colon; the new scrambled values never do). Effect: the old beta duplicate-IP check
--    forgets earlier sign-ups; new sign-ups are checked as before.
-- 2. Anonymous speed measurements and error logs are deleted after 90 days (the Privacy Policy promises this).
--    The delete runs through purge_old_diagnostics(); the block at the bottom schedules it daily if the pg_cron
--    extension is available (Supabase: Database > Extensions > pg_cron). If it is not, run
--    `select public.purge_old_diagnostics();` now and then.
-- Run this once in Supabase SQL Editor after migration_084.
-- ============================================================

delete from public.beta_ip_claims where ip_address ~ '[.:]';

create or replace function public.purge_old_diagnostics()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.performance_events where created_at < now() - interval '90 days';
  delete from public.error_events where created_at < now() - interval '90 days';
$$;

revoke all on function public.purge_old_diagnostics() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available - run select public.purge_old_diagnostics(); by hand now and then.';
  end;
  begin
    perform cron.unschedule('purge-old-diagnostics');
  exception when others then null;
  end;
  begin
    perform cron.schedule('purge-old-diagnostics', '17 3 * * *', 'select public.purge_old_diagnostics();');
  exception when others then
    raise notice 'Could not schedule the daily purge (pg_cron missing).';
  end;
end $$;

select public.purge_old_diagnostics();
