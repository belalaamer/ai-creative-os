create policy workflow_steps_insert on public.workflow_steps for insert to authenticated with check (
  exists (select 1 from public.workflow_runs r where r.id=workflow_run_id and private.has_org_role(r.organization_id,array['owner','admin','editor']::public.membership_role[]))
);
create policy workflow_steps_update on public.workflow_steps for update to authenticated using (
  exists (select 1 from public.workflow_runs r where r.id=workflow_run_id and private.has_org_role(r.organization_id,array['owner','admin','editor']::public.membership_role[]))
) with check (
  exists (select 1 from public.workflow_runs r where r.id=workflow_run_id and private.has_org_role(r.organization_id,array['owner','admin','editor']::public.membership_role[]))
);
create policy generations_insert on public.generations for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
create policy generations_update on public.generations for update to authenticated using (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[])) with check (private.has_org_role(organization_id,array['owner','admin','editor']::public.membership_role[]));
