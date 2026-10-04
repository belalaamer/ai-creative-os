-- AI Creative OS - Foundation schema
create extension if not exists pgcrypto;

create type public.membership_role as enum ('owner','admin','editor','viewer');
create type public.project_status as enum ('draft','active','archived');
create type public.job_status as enum ('queued','processing','succeeded','failed','cancelled');
create type public.generation_kind as enum ('text','image','video','audio','landing_page');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text,
  description text,
  tone_of_voice jsonb not null default '{}'::jsonb,
  visual_identity jsonb not null default '{}'::jsonb,
  defaults jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  asset_type text not null,
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  price jsonb,
  offer jsonb,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  status public.project_status not null default 'draft',
  brief jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delta bigint not null,
  reason text not null,
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  code text not null,
  kind public.generation_kind not null,
  quality_tier text not null check (quality_tier in ('fast','quality','ultra')),
  enabled boolean not null default true,
  pricing jsonb not null default '{}'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  unique(provider_id, code)
);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  workflow_key text not null,
  status public.job_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  idempotency_key text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique(organization_id, idempotency_key)
);

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.workflow_runs(id) on delete cascade,
  step_key text not null,
  sequence_no integer not null,
  status public.job_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique(workflow_run_id, step_key)
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  workflow_step_id uuid references public.workflow_steps(id) on delete set null,
  kind public.generation_kind not null,
  provider_code text,
  model_code text,
  status public.job_status not null default 'queued',
  prompt jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  external_job_id text,
  provider_cost_usd numeric(12,6),
  credits_charged bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  asset_type text not null,
  storage_path text not null,
  mime_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.organization_members(user_id, organization_id);
create index on public.brands(organization_id);
create index on public.projects(organization_id, created_at desc);
create index on public.workflow_runs(organization_id, status, created_at desc);
create index on public.generations(organization_id, status, created_at desc);
create index on public.credit_transactions(organization_id, created_at desc);

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed public.membership_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = any(allowed)
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.brand_products enable row level security;
alter table public.projects enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.generations enable row level security;
alter table public.generation_assets enable row level security;

create policy org_select on public.organizations for select using (public.is_org_member(id));
create policy members_select on public.organization_members for select using (public.is_org_member(organization_id));
create policy brands_select on public.brands for select using (public.is_org_member(organization_id));
create policy brands_write on public.brands for all using (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[])) with check (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[]));
create policy projects_select on public.projects for select using (public.is_org_member(organization_id));
create policy projects_write on public.projects for all using (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[])) with check (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[]));
create policy wallet_select on public.credit_wallets for select using (public.is_org_member(organization_id));
create policy ledger_select on public.credit_transactions for select using (public.is_org_member(organization_id));
create policy runs_select on public.workflow_runs for select using (public.is_org_member(organization_id));
create policy runs_write on public.workflow_runs for all using (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[])) with check (public.has_org_role(organization_id, array['owner','admin','editor']::public.membership_role[]));
create policy generations_select on public.generations for select using (public.is_org_member(organization_id));

-- Child-table read policies resolve organization via parent.
create policy brand_assets_select on public.brand_assets for select using (
  exists (select 1 from public.brands b where b.id = brand_id and public.is_org_member(b.organization_id))
);
create policy brand_products_select on public.brand_products for select using (
  exists (select 1 from public.brands b where b.id = brand_id and public.is_org_member(b.organization_id))
);
create policy workflow_steps_select on public.workflow_steps for select using (
  exists (select 1 from public.workflow_runs r where r.id = workflow_run_id and public.is_org_member(r.organization_id))
);
create policy generation_assets_select on public.generation_assets for select using (
  exists (select 1 from public.generations g where g.id = generation_id and public.is_org_member(g.organization_id))
);

-- Provider/model catalog is readable by authenticated users; writes stay service-role only.
alter table public.ai_providers enable row level security;
alter table public.ai_models enable row level security;
create policy providers_read on public.ai_providers for select to authenticated using (enabled = true);
create policy models_read on public.ai_models for select to authenticated using (enabled = true);

-- Atomic credit debit helper. Call server-side only.
create or replace function public.debit_credits(
  p_organization_id uuid,
  p_amount bigint,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance bigint;
begin
  if p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;

  update public.credit_wallets
  set balance = balance - p_amount, updated_at = now()
  where organization_id = p_organization_id and balance >= p_amount
  returning balance into new_balance;

  if new_balance is null then raise exception 'insufficient_credits'; end if;

  insert into public.credit_transactions(organization_id, delta, reason, reference_type, reference_id, idempotency_key, metadata)
  values (p_organization_id, -p_amount, p_reason, p_reference_type, p_reference_id, p_idempotency_key, p_metadata);

  return new_balance;
end;
$$;
revoke all on function public.debit_credits(uuid,bigint,text,text,uuid,text,jsonb) from public, anon, authenticated;
