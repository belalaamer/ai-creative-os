create type public.media_job_kind as enum ('video_scene','voiceover','assembly');
create table public.media_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, generation_id uuid references public.generations(id) on delete set null,
  kind public.media_job_kind not null, scene_no integer, status public.job_status not null default 'queued', provider_code text, model_code text,
  external_job_id text, input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb, error jsonb,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz
);
create index media_jobs_org_status_idx on public.media_jobs(organization_id,status,created_at desc);
create index media_jobs_project_idx on public.media_jobs(project_id,scene_no);
create index media_jobs_generation_idx on public.media_jobs(generation_id);
create index media_jobs_created_by_idx on public.media_jobs(created_by);
alter table public.media_jobs enable row level security;
create policy media_jobs_select on public.media_jobs for select to authenticated using (private.is_org_member(organization_id));
create policy media_jobs_insert on public.media_jobs for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy media_jobs_update on public.media_jobs for update to authenticated using (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[])) with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy media_jobs_delete on public.media_jobs for delete to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
