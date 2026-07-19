-- Admin-only audit log of user actions across the app: lead created/updated/
-- stage-changed/activity-logged, and user invited/edited/removed/restored.
--
-- Writes go through SECURITY DEFINER triggers (mirroring the existing
-- leads_log_stage_change -> lead_status_history pattern) plus one explicit
-- insert from the admin-invite-user Edge Function for invites (which run
-- under the service-role key, outside any user's session). There is
-- deliberately no insert/update/delete policy for the `authenticated` role —
-- the only way to write a row is via a security-definer function or the
-- service role, so regular users can't tamper with the log even though RLS
-- lets them read leads/profiles.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  lead_id uuid references public.leads(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit log admin read" on public.audit_log
  for select
  using (is_admin());

create or replace function public.log_audit(
  p_action text,
  p_lead_id uuid,
  p_target_user_id uuid,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
as $$
begin
  -- Service-role writes (e.g. the invite Edge Function) have no auth.uid()
  -- and log themselves explicitly instead, with the real acting admin's id.
  if auth.uid() is null then
    return;
  end if;

  insert into public.audit_log (actor_id, action, lead_id, target_user_id, details)
  values (auth.uid(), p_action, p_lead_id, p_target_user_id, p_details);
end;
$$;

create or replace function public.audit_lead_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.log_audit('lead.created', new.id, null, jsonb_build_object('name', new.name));
  return new;
end;
$$;

create trigger leads_audit_insert
  after insert on public.leads
  for each row execute function public.audit_lead_insert();

create or replace function public.audit_lead_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.stage is distinct from new.stage then
    perform public.log_audit('lead.stage_changed', new.id, null, jsonb_build_object('from', old.stage, 'to', new.stage));
  else
    perform public.log_audit('lead.updated', new.id, null, null);
  end if;
  return new;
end;
$$;

create trigger leads_audit_update
  after update on public.leads
  for each row execute function public.audit_lead_update();

create or replace function public.audit_lead_activity_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.log_audit('lead.activity_logged', new.lead_id, null, jsonb_build_object('type', new.type));
  return new;
end;
$$;

create trigger lead_activity_audit_insert
  after insert on public.lead_activity
  for each row execute function public.audit_lead_activity_insert();

create or replace function public.audit_profile_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.role is distinct from new.role then
    perform public.log_audit('user.role_changed', null, new.id, jsonb_build_object('from', old.role, 'to', new.role));
  end if;

  if old.status is distinct from new.status then
    perform public.log_audit(
      case when new.status = 'disabled' then 'user.removed' else 'user.restored' end,
      null, new.id, null
    );
  end if;

  if old.full_name is distinct from new.full_name then
    perform public.log_audit('user.name_changed', null, new.id, jsonb_build_object('from', old.full_name, 'to', new.full_name));
  end if;

  return new;
end;
$$;

create trigger profiles_audit_update
  after update on public.profiles
  for each row execute function public.audit_profile_update();
