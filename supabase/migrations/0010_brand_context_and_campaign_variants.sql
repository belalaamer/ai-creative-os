-- Phase 6: frozen brand context per project + reusable A/B/C campaign variants.
create table public.brand_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  context jsonb not null,
  context_hash text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.campaign_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  variant_key text not null check (variant_key in ('A','B','C')),
  title text not null,
  angle text not null,
  hook text not null,
  primary_text text not null,
  headline text not null,
  cta text not null,
  script text not null,
  audience text,
  rationale text,
  mode text not null default 'development' check (mode in ('provider','development')),
  provider_code text,
  model_code text,
  generation_id uuid references public.generations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, variant_key)
);
create index brand_context_snapshots_org_idx on public.brand_context_snapshots(organization_id, created_at desc);
create index brand_context_snapshots_project_idx on public.brand_context_snapshots(project_id);
create index campaign_variants_project_idx on public.campaign_variants(project_id, variant_key);
create index campaign_variants_org_idx on public.campaign_variants(organization_id, created_at desc);
alter table public.brand_context_snapshots enable row level security;
alter table public.campaign_variants enable row level security;
create policy brand_context_snapshots_select on public.brand_context_snapshots for select to authenticated using (private.is_org_member(organization_id));
create policy brand_context_snapshots_insert on public.brand_context_snapshots for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy campaign_variants_select on public.campaign_variants for select to authenticated using (private.is_org_member(organization_id));
create policy campaign_variants_insert on public.campaign_variants for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy campaign_variants_update on public.campaign_variants for update to authenticated using (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[])) with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy campaign_variants_delete on public.campaign_variants for delete to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
