-- Private asset storage. Object paths start with organization UUID.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('brand-assets', 'brand-assets', false, 20971520),
  ('generation-assets', 'generation-assets', false, 209715200)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create or replace function private.storage_org_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = storage, public, private
as $$
declare
  segment text;
begin
  segment := (storage.foldername(object_name))[1];
  if segment is null or segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return segment::uuid;
end;
$$;

revoke all on function private.storage_org_id(text) from public, anon;
grant execute on function private.storage_org_id(text) to authenticated;
