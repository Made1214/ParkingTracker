alter table public.groups
  add column description text check (length(description) <= 2000),
  add column avatar_public_id text,
  add constraint groups_avatar_scope check (
    avatar_public_id is null or avatar_public_id ~ ('^groups/' || id::text || '/[0-9a-f-]{36}$')
  );

create function private.guard_membership_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Maintenance and referential cleanup retain their normal behavior.
  if current_setting('role', true) <> 'authenticated' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id
    or new.group_id is distinct from old.group_id or new.joined_at is distinct from old.joined_at) then
    raise exception 'membership identity is immutable' using errcode = '23514';
  end if;
  -- Serialize all removals/demotions for a group before counting admins.
  perform 1 from public.groups where id = old.group_id for update;
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
    and (select count(*) from public.group_members where group_id = old.group_id and role = 'admin') <= 1 then
    raise exception 'group must retain an administrator' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.guard_membership_changes() from public, anon, authenticated;
create trigger group_members_guard_changes before update or delete on public.group_members
for each row execute function private.guard_membership_changes();

-- Lock the matched code until the join commits, serializing with code regeneration.
create or replace function public.join_group_by_invite(p_code text)
returns public.groups language plpgsql security definer set search_path = '' as $$
declare v_group public.groups; v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into v_group from public.groups where invite_code = upper(p_code) for share;
  if v_group.id is null then raise exception 'invalid invite code' using errcode = 'P0002'; end if;
  insert into public.group_members(group_id, user_id, role) values(v_group.id, v_user_id, 'member')
  on conflict(group_id, user_id) do nothing;
  return v_group;
end;
$$;
