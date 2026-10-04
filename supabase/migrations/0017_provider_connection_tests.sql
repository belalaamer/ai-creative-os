create table public.provider_test_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.generation_kind not null,
  quality_tier text not null check (quality_tier in ('fast','quality','ultra')),
  provider_code text not null,
  model_code text not null,
  route_key text,
  status text not null check (status in ('started','succeeded','failed','timed_out')),
  latency_ms integer,
  error_code text,
  error_message text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index provider_test_runs_org_idx on public.provider_test_runs(organization_id, created_at desc);
alter table public.provider_test_runs enable row level security;
create policy provider_test_runs_select on public.provider_test_runs for select to authenticated
using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy provider_test_runs_insert on public.provider_test_runs for insert to authenticated
with check (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
