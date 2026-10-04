create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  default_locale text not null default 'ar' check (default_locale in ('ar','en')),
  timezone text not null default 'Africa/Cairo',
  default_quality text not null default 'quality' check (default_quality in ('fast','quality','ultra')),
  updated_at timestamptz not null default now()
);

create table public.organization_provider_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind public.generation_kind not null,
  quality_tier text not null check (quality_tier in ('fast','quality','ultra')),
  provider_code text not null,
  model_code text not null,
  env_prefix text not null,
  priority integer not null default 100,
  enabled boolean not null default false,
  is_fallback boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  unique(organization_id, kind, quality_tier, provider_code, model_code)
);

create table public.billing_plans (
  plan_key text primary key,
  name_ar text not null,
  name_en text not null,
  monthly_credits bigint not null default 0,
  included_seats integer not null default 1,
  price_monthly_usd numeric(12,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_key text not null references public.billing_plans(plan_key),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','paused','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  external_provider text,
  external_subscription_id text,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.membership_role not null check (role <> 'owner'),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_provider_settings_lookup_idx on public.organization_provider_settings(organization_id, kind, quality_tier, enabled, priority);
create index team_invitations_org_idx on public.team_invitations(organization_id, status, created_at desc);
create unique index team_invitations_pending_email_idx on public.team_invitations(organization_id, lower(email)) where status = 'pending';
create index audit_logs_org_idx on public.audit_logs(organization_id, created_at desc);

alter table public.organization_settings enable row level security;
alter table public.organization_provider_settings enable row level security;
alter table public.billing_plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.team_invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy organization_settings_select on public.organization_settings for select to authenticated using (private.is_org_member(organization_id));
create policy organization_settings_insert on public.organization_settings for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy organization_settings_update on public.organization_settings for update to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[])) with check (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy organization_provider_settings_select on public.organization_provider_settings for select to authenticated using (private.is_org_member(organization_id));
create policy organization_provider_settings_insert on public.organization_provider_settings for insert to authenticated with check (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy organization_provider_settings_update on public.organization_provider_settings for update to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[])) with check (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy organization_provider_settings_delete on public.organization_provider_settings for delete to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy billing_plans_read on public.billing_plans for select to authenticated using (active = true);
create policy subscriptions_read on public.organization_subscriptions for select to authenticated using (private.is_org_member(organization_id));
create policy team_invitations_read on public.team_invitations for select to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));
create policy audit_logs_read on public.audit_logs for select to authenticated using (private.has_org_role(organization_id,array['owner','admin']::public.membership_role[]));

insert into public.billing_plans(plan_key,name_ar,name_en,monthly_credits,included_seats,price_monthly_usd,active,metadata,sort_order)
values ('trial','تجريبي','Trial',250,1,0,true,'{"billing_ready":true}',10),
       ('creator','منشئ المحتوى','Creator',2500,2,null,false,'{"coming_soon":true}',20),
       ('studio','الاستوديو','Studio',10000,5,null,false,'{"coming_soon":true}',30)
on conflict (plan_key) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,monthly_credits=excluded.monthly_credits,included_seats=excluded.included_seats,price_monthly_usd=excluded.price_monthly_usd,active=excluded.active,metadata=excluded.metadata,sort_order=excluded.sort_order,updated_at=now();

insert into public.organization_settings(organization_id) select id from public.organizations on conflict (organization_id) do nothing;
insert into public.organization_subscriptions(organization_id,plan_key,status,current_period_start,current_period_end)
select id,'trial','trialing',now(),now()+interval '14 days' from public.organizations on conflict (organization_id) do nothing;
