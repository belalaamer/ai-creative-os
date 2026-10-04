create table public.organization_ai_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  max_provider_cost_per_generation_usd numeric(12,6) not null default 3.00,
  max_provider_cost_per_day_usd numeric(12,6) not null default 25.00,
  max_credits_per_day bigint not null default 1000,
  max_retries_per_provider integer not null default 2 check (max_retries_per_provider between 0 and 5),
  max_failovers integer not null default 2 check (max_failovers between 0 and 5),
  request_timeout_ms integer not null default 90000 check (request_timeout_ms between 5000 and 600000),
  moderation_mode text not null default 'enforce' check (moderation_mode in ('off','warn','enforce')),
  updated_at timestamptz not null default now()
);

create table public.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  media_job_id uuid references public.media_jobs(id) on delete cascade,
  kind public.generation_kind not null,
  quality_tier text not null check (quality_tier in ('fast','quality','ultra')),
  provider_code text not null,
  model_code text not null,
  attempt_no integer not null,
  status text not null check (status in ('started','succeeded','failed','timed_out','skipped_budget','blocked_moderation')),
  latency_ms integer,
  error_code text,
  error_message text,
  estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  event_type text not null,
  severity text not null check (severity in ('info','warning','block')),
  rule_key text not null,
  matched_text text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index provider_attempts_generation_idx on public.provider_attempts(generation_id, created_at);
create index provider_attempts_provider_idx on public.provider_attempts(provider_code, created_at desc);
create index provider_attempts_org_idx on public.provider_attempts(organization_id, created_at desc);
create index moderation_events_project_idx on public.moderation_events(project_id, created_at desc);
create index moderation_events_org_idx on public.moderation_events(organization_id, created_at desc);

alter table public.organization_ai_policies enable row level security;
alter table public.provider_attempts enable row level security;
alter table public.moderation_events enable row level security;

create policy ai_policies_select on public.organization_ai_policies for select to authenticated using (private.is_org_member(organization_id));
create policy ai_policies_insert on public.organization_ai_policies for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin']::public.membership_role[]));
create policy ai_policies_update on public.organization_ai_policies for update to authenticated using (private.has_org_role(organization_id, array['owner','admin']::public.membership_role[])) with check (private.has_org_role(organization_id, array['owner','admin']::public.membership_role[]));
create policy provider_attempts_select on public.provider_attempts for select to authenticated using (private.is_org_member(organization_id));
create policy moderation_events_select on public.moderation_events for select to authenticated using (private.is_org_member(organization_id));

create or replace function public.ensure_ai_policy(p_organization_id uuid)
returns public.organization_ai_policies
language plpgsql security invoker set search_path = public
as $$
declare result public.organization_ai_policies;
begin
  if not private.is_org_member(p_organization_id) then raise exception 'forbidden'; end if;
  insert into public.organization_ai_policies(organization_id) values (p_organization_id) on conflict (organization_id) do nothing;
  select * into result from public.organization_ai_policies where organization_id=p_organization_id;
  return result;
end;
$$;

create or replace function public.provider_budget_snapshot(p_organization_id uuid)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare policy_row public.organization_ai_policies; spent_usd numeric(12,6); spent_credits bigint;
begin
  if not private.is_org_member(p_organization_id) then raise exception 'forbidden'; end if;
  select * into policy_row from public.organization_ai_policies where organization_id=p_organization_id;
  if not found then insert into public.organization_ai_policies(organization_id) values (p_organization_id) returning * into policy_row; end if;
  select coalesce(sum(provider_cost_usd),0) into spent_usd from public.generation_costs where organization_id=p_organization_id and created_at>=date_trunc('day',now());
  select coalesce(sum(abs(delta)),0) into spent_credits from public.credit_transactions where organization_id=p_organization_id and delta<0 and created_at>=date_trunc('day',now());
  return jsonb_build_object(
    'spent_provider_usd_today',spent_usd,'spent_credits_today',spent_credits,
    'max_provider_cost_per_generation_usd',policy_row.max_provider_cost_per_generation_usd,
    'max_provider_cost_per_day_usd',policy_row.max_provider_cost_per_day_usd,
    'max_credits_per_day',policy_row.max_credits_per_day,
    'max_retries_per_provider',policy_row.max_retries_per_provider,
    'max_failovers',policy_row.max_failovers,
    'request_timeout_ms',policy_row.request_timeout_ms,
    'moderation_mode',policy_row.moderation_mode
  );
end;
$$;

revoke all on function public.ensure_ai_policy(uuid) from public, anon;
grant execute on function public.ensure_ai_policy(uuid) to authenticated;
revoke all on function public.provider_budget_snapshot(uuid) from public, anon;
grant execute on function public.provider_budget_snapshot(uuid) to authenticated;

insert into public.organization_ai_policies(organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
