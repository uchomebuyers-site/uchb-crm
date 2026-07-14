-- Schedules the follow-up-digest Edge Function to run daily at 7:00 AM
-- Central time.
--
-- DST WARNING: pg_cron schedules run on a fixed UTC time and do not adjust
-- for daylight saving. Central time is UTC-5 during CDT (roughly
-- mid-March to early November) and UTC-6 during CST (the rest of the
-- year). This migration hardcodes 12:00 UTC, which is correct for CDT
-- (as of when this was written, July). Once DST ends, 7:00 AM Central
-- will actually fire at 6:00 AM until this is manually updated to
-- 13:00 UTC (and back again the following spring). Flagging this rather
-- than solving it now — a future fix should either recompute the cron
-- expression twice a year, or move to a scheduler that understands IANA
-- time zones (e.g. an external cron calling the function with tz-aware
-- logic, or re-scheduling via a small twice-yearly migration/cron job).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Prerequisite (run once, manually, before this migration): store the
-- service role key in Supabase Vault so this cron job can authenticate to
-- the Edge Function without the key ever appearing in a migration file
-- (migrations are committed to git).
--
--   select vault.create_secret('<service-role-key-value>', 'service_role_key');
--
-- Do this via the Supabase SQL Editor directly — never paste the actual
-- key into a file that gets committed.

select cron.schedule(
  'follow-up-digest-daily',
  '0 12 * * *', -- 12:00 UTC = 7:00 AM Central (CDT). See DST warning above.
  $$
  select net.http_post(
    url := 'https://kzunnrpgrildhsltrprn.supabase.co/functions/v1/follow-up-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
