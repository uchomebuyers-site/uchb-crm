-- Lead tags: a configurable many-to-many taxonomy (Foreclosure, FSBO, Tired
-- Landlord, Expired Listing, ...) — same "read from the table, never
-- hard-code" pattern as stages/sources. `tags` is the label list (anyone on
-- the team can read it, only admins manage the list itself); `lead_tags` is
-- the per-lead assignment (any team member can add/remove, same access as
-- the rest of a lead's working data).

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  created_at timestamptz not null default now()
);

create table public.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;

create policy "tags anyone read" on public.tags
  for select
  using (true);

create policy "tags admin write" on public.tags
  for all
  using (is_admin())
  with check (is_admin());

create policy "lead_tags team access" on public.lead_tags
  for all
  using (is_team_member())
  with check (is_team_member());

insert into public.tags (label) values
  ('Foreclosure'),
  ('FSBO'),
  ('Tired Landlord'),
  ('Expired Listing');

-- Per-user email mute — self-service (profiles already has a
-- self-update-own RLS policy) and admin-editable (profiles already has an
-- admin-update-any policy). In-app notifications are unaffected; this only
-- gates the email side of things.
alter table public.profiles add column email_notifications_enabled boolean not null default true;

-- The actual listing URL, when the property is on-market/FSBO and we know
-- it — distinct from the always-available auto-generated Zillow search
-- link, which needs no stored data at all.
alter table public.leads add column listing_url text;
