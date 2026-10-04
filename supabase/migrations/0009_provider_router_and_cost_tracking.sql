create table public.provider_routes (
  id uuid primary key default gen_random_uuid(),
  kind public.generation_kind not null,
  quality_tier text not null check (quality_tier in ('fast','quality','ultra')),
  provider_code text not null,
  model_code text not null,
  priority integer not null default 100,
  enabled boolean not null default true,
  max_cost_usd numeric(12,6),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind, quality_tier, provider_code, model_code)
);

create table public.provider_health (
  provider_code text primary key,
  status text not null default 'unknown' check (status in ('healthy','degraded','down','unknown')),
  success_rate numeric(6,5),
  avg_latency_ms integer,
  consecutive_failures integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.generation_costs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null unique references public.generations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_code text not null,
  model_code text not null,
  provider_cost_usd numeric(12,6) not null default 0,
  billable_credits bigint not null default 0,
  internal_credit_value_usd numeric(12,6) not null default 0,
  revenue_usd numeric(12,6) not null default 0,
  gross_margin_usd numeric(12,6) generated always as (revenue_usd - provider_cost_usd) stored,
  gross_margin_pct numeric(9,4) generated always as (case when revenue_usd > 0 then ((revenue_usd - provider_cost_usd) / revenue_usd) * 100 else null end) stored,
  raw_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index provider_routes_lookup_idx on public.provider_routes(kind, quality_tier, enabled, priority);
create index generation_costs_org_idx on public.generation_costs(organization_id, created_at desc);

alter table public.provider_routes enable row level security;
alter table public.provider_health enable row level security;
alter table public.generation_costs enable row level security;
create policy provider_routes_read on public.provider_routes for select to authenticated using (enabled = true);
create policy provider_health_read on public.provider_health for select to authenticated using (true);
create policy generation_costs_read on public.generation_costs for select to authenticated using (private.is_org_member(organization_id));
