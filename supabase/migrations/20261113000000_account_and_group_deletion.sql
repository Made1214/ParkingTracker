-- 20261113000000_account_and_group_deletion.sql
-- API §3.2 (delete group) and RNF-12 (delete account).
--
-- Cloudinary is not reachable from Postgres, so both operations return
-- the public_ids they orphaned. The matching server action deletes those
-- assets best-effort afterwards: a failed CDN cleanup must never keep a
-- deleted group or a deleted account alive in the database.
--
-- The membership guard (private.guard_membership_changes) raises when the
-- last admin of an existing group is removed or demoted. Both functions
-- therefore resolve succession BEFORE removing memberships, and rely on
-- the fact that an ON DELETE CASCADE from public.groups removes the
-- parent row before the child rows are deleted, so the guard's
-- `select ... from public.groups ... for update` finds nothing and lets
-- the cascade through (same behavior the existing "group must retain an
-- administrator" check documents for group deletion).

-- Delete a group on behalf of one of its admins. Returns every Cloudinary
-- public_id that belonged to the group so the caller can clean it up.
create or replace function public.delete_group(p_group_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_found uuid;
  v_avatar text;
  v_assets text[] := '{}';
  v_ids text[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Check authorization before existence so a non-member cannot probe
  -- group ids, and so a missing group is indistinguishable from a group
  -- the caller does not administer.
  if not (select private.is_group_admin(p_group_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select g.id, g.avatar_public_id into v_found, v_avatar
  from public.groups g where g.id = p_group_id;
  if v_found is null then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  -- Serialize with concurrent membership changes before collecting assets.
  perform 1 from public.groups where id = p_group_id for update;

  if v_avatar is not null then
    v_assets := v_assets || v_avatar;
  end if;
  select coalesce(
    array_agg(e.cover_public_id order by e.id)
      filter (where e.cover_public_id is not null),
    '{}'::text[]
  ) into v_ids
  from public.events e where e.group_id = p_group_id;
  v_assets := v_assets || v_ids;
  select coalesce(
    array_agg(p.cloudinary_public_id order by p.id),
    '{}'::text[]
  ) into v_ids
  from public.photos p where p.group_id = p_group_id;
  v_assets := v_assets || v_ids;

  -- Cascades to events, members, photos, expenses, tasks, polls, etc.
  delete from public.groups where id = p_group_id;
  return v_assets;
end;
$$;
revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;

-- Delete the caller's account.
--
-- Groups where the caller is the only admin get a successor admin (the
-- earliest-joined remaining member). Groups where the caller is the only
-- member are deleted entirely, since they cannot outlive their last
-- person. Everything else is a plain membership removal.
--
-- expenses.paid_by and expense_splits.user_id are ON DELETE RESTRICT on
-- public.profiles: a balance with an unknown payer is unresolvable
-- arithmetic. An account with expense history is therefore anonymized
-- instead of removed, while its Auth row is scrubbed and banned so the
-- account can never sign in again (RNF-12 allows "delete or anonymize").
create or replace function public.delete_my_account()
returns table (
  deleted_avatar_public_id text,
  deleted_group_avatars text[],
  deleted_event_covers text[],
  deleted_photos text[]
) language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_avatar text;
  v_group_avatars text[] := '{}';
  v_event_covers text[] := '{}';
  v_photos text[] := '{}';
  v_group_ids uuid[];
  v_group_id uuid;
  v_group_avatar text;
  v_ids text[];
  v_successor uuid;
  v_has_expense_history boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.avatar_public_id into v_avatar
  from public.profiles p where p.id = v_uid;

  -- Groups where the caller is the sole administrator.
  select coalesce(array_agg(g.id order by g.id), '{}'::uuid[])
  into v_group_ids
  from public.groups g
  where exists (
    select 1 from public.group_members me
    where me.group_id = g.id and me.user_id = v_uid and me.role = 'admin'
  ) and not exists (
    select 1 from public.group_members other
    where other.group_id = g.id and other.user_id <> v_uid and other.role = 'admin'
  );

  foreach v_group_id in array v_group_ids loop
    select g.avatar_public_id into v_group_avatar
    from public.groups g where g.id = v_group_id for update;
    if not found then
      continue;
    end if;

    select gm.user_id into v_successor
    from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id <> v_uid
    order by gm.joined_at asc, gm.user_id asc
    limit 1;

    if v_successor is not null then
      -- Two admins exist after this update, so the guard lets the
      -- caller's membership go below.
      update public.group_members set role = 'admin'
      where group_id = v_group_id and user_id = v_successor;
    else
      -- Sole member: collect the group's assets before cascading it away.
      if v_group_avatar is not null then
        v_group_avatars := v_group_avatars || v_group_avatar;
      end if;
      select coalesce(
        array_agg(e.cover_public_id order by e.id)
          filter (where e.cover_public_id is not null),
        '{}'::text[]
      ) into v_ids
      from public.events e where e.group_id = v_group_id;
      v_event_covers := v_event_covers || v_ids;
      select coalesce(
        array_agg(p.cloudinary_public_id order by p.id),
        '{}'::text[]
      ) into v_ids
      from public.photos p where p.group_id = v_group_id;
      v_photos := v_photos || v_ids;
      delete from public.groups where id = v_group_id;
    end if;
  end loop;

  -- paid_by and expense_splits.user_id are ON DELETE RESTRICT: a balance
  -- with an unknown payer is unresolvable, so accounts with expense
  -- history are anonymized instead of removed. Check this before leaving
  -- the groups, while the caller's RLS still exposes every historical row.
  select exists (select 1 from public.expenses where paid_by = v_uid)
      or exists (select 1 from public.expense_splits where user_id = v_uid)
  into v_has_expense_history;

  -- Leave every remaining group. Sole-admin groups now have two admins,
  -- and groups with another admin keep at least one, so the guard passes.
  delete from public.group_members where user_id = v_uid;

  if v_has_expense_history then
    update public.profiles
    set display_name = 'Cuenta eliminada',
        username = null,
        avatar_url = null,
        avatar_public_id = null
    where id = v_uid;
    update auth.users
    set email = 'deleted-' || v_uid::text || '@deleted.invalid',
        encrypted_password = '',
        email_change = '',
        raw_user_meta_data = '{}'::jsonb,
        banned_until = 'infinity'
    where id = v_uid;
  else
    -- Cascades to public.profiles and every membership/profile FK.
    delete from auth.users where id = v_uid;
  end if;

  return query
  select v_avatar, v_group_avatars, v_event_covers, v_photos;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
