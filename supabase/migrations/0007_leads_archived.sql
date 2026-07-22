-- Soft-delete for leads: null = active, a timestamp = archived (and when).
-- Used by the foreclosure-lead-manage Edge Function so Hermes can retire a
-- record it created without a hard DELETE — recoverable by clearing the
-- column, unlike a real delete.

alter table public.leads add column archived_at timestamptz;
