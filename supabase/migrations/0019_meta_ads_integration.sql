create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  meta_user_id text,
  meta_user_name text,
  status text not null default 'connected' check (status in ('connected','expired','revoked','error')),
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meta_connections enable row level security;
drop policy if exists "meta_connections_select_org_members" on public.meta_connections;
create policy "meta_connections_select_org_members" on public.meta_connections
for select to authenticated using (private.is_org_member(organization_id));

create table if not exists private.meta_credentials (
  connection_id uuid primary key references public.meta_connections(id) on delete cascade,
  token_ciphertext text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_meta_credential(p_connection_id uuid, p_ciphertext text)
returns void language plpgsql security definer set search_path = public, private
as $$
begin
  insert into private.meta_credentials(connection_id, token_ciphertext, updated_at)
  values (p_connection_id, p_ciphertext, now())
  on conflict (connection_id) do update
  set token_ciphertext = excluded.token_ciphertext, updated_at = now();
end;
$$;

create or replace function public.get_meta_credential(p_connection_id uuid)
returns text language sql security definer set search_path = public, private
as $$ select token_ciphertext from private.meta_credentials where connection_id = p_connection_id; $$;

create or replace function public.clear_meta_credential(p_connection_id uuid)
returns void language plpgsql security definer set search_path = public, private
as $$ begin delete from private.meta_credentials where connection_id = p_connection_id; end; $$;

revoke all on function public.set_meta_credential(uuid,text) from public, anon, authenticated;
revoke all on function public.get_meta_credential(uuid) from public, anon, authenticated;
revoke all on function public.clear_meta_credential(uuid) from public, anon, authenticated;
grant execute on function public.set_meta_credential(uuid,text) to service_role;
grant execute on function public.get_meta_credential(uuid) to service_role;
grant execute on function public.clear_meta_credential(uuid) to service_role;

create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.meta_connections(id) on delete cascade,
  ad_account_id text not null,
  name text,
  currency text,
  timezone_name text,
  account_status integer,
  is_selected boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, ad_account_id)
);

alter table public.meta_ad_accounts enable row level security;
drop policy if exists "meta_ad_accounts_select_org_members" on public.meta_ad_accounts;
create policy "meta_ad_accounts_select_org_members" on public.meta_ad_accounts
for select to authenticated using (private.is_org_member(organization_id));

create table if not exists public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.meta_connections(id) on delete cascade,
  page_id text not null,
  name text,
  instagram_business_account_id text,
  instagram_username text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, page_id)
);

alter table public.meta_pages enable row level security;
drop policy if exists "meta_pages_select_org_members" on public.meta_pages;
create policy "meta_pages_select_org_members" on public.meta_pages
for select to authenticated using (private.is_org_member(organization_id));

create index if not exists meta_ad_accounts_connection_idx on public.meta_ad_accounts(connection_id);
create index if not exists meta_pages_connection_idx on public.meta_pages(connection_id);
