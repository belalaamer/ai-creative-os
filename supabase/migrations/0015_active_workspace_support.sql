alter table public.profiles add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;
create index if not exists profiles_active_org_idx on public.profiles(active_organization_id);

update public.profiles p
set active_organization_id=(select om.organization_id from public.organization_members om where om.user_id=p.user_id order by om.created_at asc limit 1)
where p.active_organization_id is null;

create or replace function public.set_active_organization(p_organization_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
begin
  if not private.is_org_member(p_organization_id) then raise exception 'forbidden'; end if;
  update public.profiles set active_organization_id=p_organization_id,updated_at=now() where user_id=auth.uid();
  return p_organization_id;
end; $$;
revoke all on function public.set_active_organization(uuid) from public,anon;
grant execute on function public.set_active_organization(uuid) to authenticated;

create or replace function public.get_active_organization()
returns uuid language plpgsql security invoker set search_path=public as $$
declare org_id uuid;
begin
  select active_organization_id into org_id from public.profiles where user_id=auth.uid();
  if org_id is not null and private.is_org_member(org_id) then return org_id; end if;
  select organization_id into org_id from public.organization_members where user_id=auth.uid() order by created_at asc limit 1;
  if org_id is not null then update public.profiles set active_organization_id=org_id,updated_at=now() where user_id=auth.uid(); end if;
  return org_id;
end; $$;
revoke all on function public.get_active_organization() from public,anon;
grant execute on function public.get_active_organization() to authenticated;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path=public,private as $$
declare new_org_id uuid; base_name text; org_slug text; trial_credits bigint:=250;
begin
  base_name:=coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),split_part(coalesce(new.email,'workspace'),'@',1),'Workspace');
  org_slug:=lower(regexp_replace(base_name,'[^a-zA-Z0-9]+','-','g')); org_slug:=trim(both '-' from org_slug); if org_slug='' then org_slug:='workspace'; end if; org_slug:=org_slug||'-'||substr(replace(new.id::text,'-',''),1,8);
  insert into public.organizations(name,slug,created_by) values(base_name,org_slug,new.id) returning id into new_org_id;
  insert into public.profiles(user_id,display_name,active_organization_id) values(new.id,base_name,new_org_id)
    on conflict(user_id) do update set active_organization_id=coalesce(public.profiles.active_organization_id,excluded.active_organization_id);
  insert into public.organization_members(organization_id,user_id,role) values(new_org_id,new.id,'owner');
  insert into public.credit_wallets(organization_id,balance) values(new_org_id,trial_credits);
  insert into public.credit_transactions(organization_id,delta,reason,idempotency_key,metadata)
    values(new_org_id,trial_credits,'trial_signup','trial:'||new.id::text,jsonb_build_object('source','signup','trial_credits',trial_credits));
  insert into public.organization_settings(organization_id) values(new_org_id);
  insert into public.organization_ai_policies(organization_id) values(new_org_id) on conflict(organization_id) do nothing;
  insert into public.organization_subscriptions(organization_id,plan_key,status,current_period_start,current_period_end)
    values(new_org_id,'trial','trialing',now(),now()+interval '14 days');
  return new;
end; $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
