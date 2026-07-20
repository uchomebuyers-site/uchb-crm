-- Per-user saved column visibility for the Leads desktop table view.
-- profiles already has a "self-update-own" RLS policy, so no RLS change
-- is needed for a user to write their own preference here.

alter table public.profiles add column leads_column_prefs jsonb;
