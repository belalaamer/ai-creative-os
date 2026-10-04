-- Security hardening + performance indexes applied after onboarding migration.
-- The live database has explicit authenticated-only RLS policies and covering FK indexes.

create index if not exists brand_assets_brand_id_idx on public.brand_assets(brand_id);
create index if not exists brand_products_brand_id_idx on public.brand_products(brand_id);
create index if not exists brands_created_by_idx on public.brands(created_by);
create index if not exists generation_assets_generation_id_idx on public.generation_assets(generation_id);
create index if not exists generations_created_by_idx on public.generations(created_by);
create index if not exists generations_project_id_idx on public.generations(project_id);
create index if not exists generations_workflow_step_id_idx on public.generations(workflow_step_id);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists projects_brand_id_idx on public.projects(brand_id);
create index if not exists projects_created_by_idx on public.projects(created_by);
create index if not exists workflow_runs_created_by_idx on public.workflow_runs(created_by);
create index if not exists workflow_runs_project_id_idx on public.workflow_runs(project_id);
