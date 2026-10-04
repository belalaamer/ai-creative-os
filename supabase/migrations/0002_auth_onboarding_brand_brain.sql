-- Applied to Supabase project qsyjddhfzahhdwmkcbiv on 2026-10-04.
-- Adds user onboarding + Brand Brain primitives.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  locale text not null default 'ar',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_audiences (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  demographics jsonb not null default '{}'::jsonb,
  psychographics jsonb not null default '{}'::jsonb,
  pains jsonb not null default '[]'::jsonb,
  desires jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_offers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  original_price numeric(12,2),
  offer_price numeric(12,2),
  currency text not null default 'EGP',
  valid_from timestamptz,
  valid_to timestamptz,
  terms jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_guidelines (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  preferred_phrases jsonb not null default '[]'::jsonb,
  forbidden_phrases jsonb not null default '[]'::jsonb,
  forbidden_claims jsonb not null default '[]'::jsonb,
  legal_notes text,
  cta_preferences jsonb not null default '{}'::jsonb,
  content_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists brand_audiences_brand_id_idx on public.brand_audiences(brand_id);
create index if not exists brand_offers_brand_id_active_idx on public.brand_offers(brand_id, active);

alter table public.profiles enable row level security;
alter table public.brand_audiences enable row level security;
alter table public.brand_offers enable row level security;
alter table public.brand_guidelines enable row level security;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  new_org_id uuid;
  base_name text;
  org_slug text;
begin
  base_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    split_part(coalesce(new.email, 'workspace'), '@', 1),
    'Workspace'
  );

  insert into public.profiles(user_id, display_name)
  values (new.id, base_name)
  on conflict (user_id) do nothing;

  org_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9]+', '-', 'g'));
  org_slug := trim(both '-' from org_slug);
  if org_slug = '' then org_slug := 'workspace'; end if;
  org_slug := org_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.organizations(name, slug, created_by)
  values (base_name, org_slug, new.id)
  returning id into new_org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.credit_wallets(organization_id, balance)
  values (new_org_id, 0);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_ai_creative_os on auth.users;
create trigger on_auth_user_created_ai_creative_os
after insert on auth.users
for each row execute function private.handle_new_user();
