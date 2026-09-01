-- 006_group_rpcs.sql
-- The only two doors into group_members. Both SECURITY DEFINER because
-- the caller, by definition, is not yet a member -- no RLS policy could
-- ever permit the insert otherwise.

create or replace function public.create_group(p_name text, p_photo_url text default null)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group   public.groups;
  v_code    text;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 8-char uppercase alphanumeric invite code, regenerated on collision.
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;

  insert into public.groups (name, photo_url, invite_code, created_by)
  values (p_name, p_photo_url, v_code, v_user_id)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'admin');

  return v_group;
end;
$$;

create or replace function public.join_group_by_invite(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group   public.groups;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_group from public.groups where invite_code = upper(p_code);

  if v_group.id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  -- Idempotent: a double-clicked invite link cannot create two
  -- memberships or raise an error on the second click.
  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;

revoke execute on function public.create_group(text, text)  from public, anon;
revoke execute on function public.join_group_by_invite(text) from public, anon;
grant  execute on function public.create_group(text, text)  to authenticated;
grant  execute on function public.join_group_by_invite(text) to authenticated;
