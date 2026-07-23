-- Per-person bearer tokens for the crm-mcp Edge Function (Claude Project /
-- chat access to the CRM). Storing a hash, not the raw token, same
-- principle as a password — the plaintext is only ever shown once, at
-- creation time, to the person it belongs to.
--
-- No RLS policy for the `authenticated` role at all, on purpose: this table
-- is only ever touched by the service-role client inside crm-mcp, the same
-- pattern as audit_log being unwritable by regular client sessions.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.api_tokens enable row level security;
