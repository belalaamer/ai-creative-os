create table public.credit_prices (
  action_key text primary key,
  credits bigint not null check (credits >= 0),
  display_name_ar text not null,
  display_name_en text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.credit_prices enable row level security;
create policy credit_prices_read on public.credit_prices for select to authenticated using (active = true);

insert into public.credit_prices(action_key,credits,display_name_ar,display_name_en,metadata)
values
  ('creative_brief',2,'تحليل Creative Brief','Creative Brief analysis','{"kind":"text"}'),
  ('storyboard',2,'توليد Storyboard','Storyboard generation','{"kind":"text"}'),
  ('image_scene',8,'توليد صورة مشهد','Scene image generation','{"kind":"image"}'),
  ('voice_scene',4,'توليد تعليق صوتي','Scene voiceover','{"kind":"audio"}'),
  ('video_scene',40,'تحويل مشهد إلى فيديو','Scene video generation','{"kind":"video"}'),
  ('final_assembly',10,'تجميع الفيديو النهائي','Final video assembly','{"kind":"video"}');

create or replace function public.grant_credits(
  p_organization_id uuid,
  p_amount bigint,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare new_balance bigint; existing_delta bigint;
begin
  if p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;
  if p_idempotency_key is not null then
    select delta into existing_delta from public.credit_transactions where idempotency_key = p_idempotency_key;
    if found then
      select balance into new_balance from public.credit_wallets where organization_id = p_organization_id;
      return new_balance;
    end if;
  end if;
  insert into public.credit_wallets(organization_id,balance)
  values (p_organization_id,p_amount)
  on conflict (organization_id) do update
  set balance = public.credit_wallets.balance + excluded.balance, updated_at = now()
  returning balance into new_balance;
  insert into public.credit_transactions(organization_id,delta,reason,reference_type,reference_id,idempotency_key,metadata)
  values (p_organization_id,p_amount,p_reason,p_reference_type,p_reference_id,p_idempotency_key,p_metadata);
  return new_balance;
end;
$$;

create or replace function public.refund_credits(
  p_organization_id uuid,
  p_amount bigint,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = public
as $$
begin
  return public.grant_credits(p_organization_id,p_amount,p_reason,p_reference_type,p_reference_id,p_idempotency_key,p_metadata);
end;
$$;

revoke all on function public.grant_credits(uuid,bigint,text,text,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.refund_credits(uuid,bigint,text,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.debit_credits(uuid,bigint,text,text,uuid,text,jsonb) to service_role;
grant execute on function public.grant_credits(uuid,bigint,text,text,uuid,text,jsonb) to service_role;
grant execute on function public.refund_credits(uuid,bigint,text,text,uuid,text,jsonb) to service_role;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, private
as $$
declare new_org_id uuid; base_name text; org_slug text; trial_credits bigint := 250;
begin
  base_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),split_part(coalesce(new.email, 'workspace'), '@', 1),'Workspace');
  insert into public.profiles(user_id, display_name) values (new.id, base_name) on conflict (user_id) do nothing;
  org_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  org_slug := trim(both '-' from org_slug);
  if org_slug = '' then org_slug := 'workspace'; end if;
  org_slug := org_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
  insert into public.organizations(name, slug, created_by) values (base_name, org_slug, new.id) returning id into new_org_id;
  insert into public.organization_members(organization_id, user_id, role) values (new_org_id, new.id, 'owner');
  insert into public.credit_wallets(organization_id, balance) values (new_org_id, trial_credits);
  insert into public.credit_transactions(organization_id, delta, reason, idempotency_key, metadata)
  values (new_org_id, trial_credits, 'trial_signup', 'trial:' || new.id::text, jsonb_build_object('source','signup','trial_credits',trial_credits));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
