-- Phase 2: allow authenticated organization editors to persist generated assets.
create policy generation_assets_insert on public.generation_assets
for insert to authenticated
with check (
  exists (
    select 1 from public.generations g
    where g.id = generation_id
      and private.has_org_role(
        g.organization_id,
        array['owner','admin','editor']::public.membership_role[]
      )
  )
);

create policy generation_assets_update on public.generation_assets
for update to authenticated
using (
  exists (
    select 1 from public.generations g
    where g.id = generation_id
      and private.has_org_role(
        g.organization_id,
        array['owner','admin','editor']::public.membership_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.generations g
    where g.id = generation_id
      and private.has_org_role(
        g.organization_id,
        array['owner','admin','editor']::public.membership_role[]
      )
  )
);

create policy generation_assets_delete on public.generation_assets
for delete to authenticated
using (
  exists (
    select 1 from public.generations g
    where g.id = generation_id
      and private.has_org_role(
        g.organization_id,
        array['owner','admin']::public.membership_role[]
      )
  )
);
