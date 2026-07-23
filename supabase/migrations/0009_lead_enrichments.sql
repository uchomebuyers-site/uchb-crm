-- On-demand data enrichment (RentCast property/value/rent, Tracerfy skip
-- trace), triggered by a button click from the lead detail page — never
-- automatic, so it never costs money without an explicit human action.
--
-- Append-only log, same shape as lead_activity/audit_log: a lead can be
-- re-pulled over time (e.g. a fresh value estimate 6 months later) and we
-- keep the history rather than overwriting, since "collect all info we
-- research" implies a running record, not just the latest snapshot.

alter table public.leads add column county text;

create table public.lead_enrichments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in ('property_lookup', 'value_estimate', 'rent_estimate', 'skip_trace')),
  provider text not null,
  status text not null check (status in ('success', 'no_match', 'error')),
  requested_by uuid references public.profiles(id) on delete set null,
  summary jsonb,
  raw_response jsonb,
  cost_cents integer,
  created_at timestamptz not null default now()
);

create index lead_enrichments_lead_id_idx on public.lead_enrichments (lead_id, type, created_at desc);

alter table public.lead_enrichments enable row level security;

create policy "lead_enrichments team access" on public.lead_enrichments
  for all
  using (is_team_member())
  with check (is_team_member());
