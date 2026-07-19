-- Adds a 'member' role tier between 'admin' and 'pending': someone who can
-- do full lead-working (leads, activity log, pipeline, follow-ups) but not
-- admin-only actions (user management, which stays gated by is_admin()).
--
-- 'role' has no CHECK constraint (only 'status' does), so no ALTER TABLE
-- is needed to allow the new value — this is purely additive RLS.
--
-- leads/lead_activity/lead_status_history currently only grant access via
-- an admin-only policy (is_admin()). This adds a second, broader policy
-- for both admin and member — the existing admin-only policies are left
-- in place untouched (Postgres ORs permissive policies together, so this
-- doesn't change anything for admins, it only adds member access).

create or replace function public.is_team_member()
returns boolean
language sql
stable security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'member') and status = 'active'
  );
$$;

create policy "leads team access" on public.leads
  for all
  using (is_team_member())
  with check (is_team_member());

create policy "activity team access" on public.lead_activity
  for all
  using (is_team_member())
  with check (is_team_member());

create policy "history team read" on public.lead_status_history
  for select
  using (is_team_member());
