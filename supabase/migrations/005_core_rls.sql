-- 005_core_rls.sql
-- RLS + policies for profiles, groups, group_members, now that the
-- helper functions they depend on exist.

-- ---------------------------------------------------------------------
-- profiles

alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

-- Read: yourself, or anyone you share at least one group with. Never
-- `using (true)` -- that leaks every user's name/avatar platform-wide.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.shares_group_with(id)));

create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT/DELETE policy: rows are created only by the trigger below and
-- deleted only via auth.users cascade. Never direct client writes.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Creates a profile the moment a user signs up (email/password or OAuth),
-- so the very first authenticated query already has a profile row.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- groups

alter table public.groups enable row level security;
alter table public.groups force  row level security;

create policy groups_select on public.groups for select to authenticated
  using ((select private.is_group_member(id)));

-- No direct INSERT policy: groups are created via the create_group RPC
-- (006_group_rpcs.sql) so the creator is atomically added as admin in
-- the same transaction. A bare insert policy would create orphan groups
-- with zero members.

create policy groups_update on public.groups for update to authenticated
  using ((select private.is_group_admin(id)))
  with check ((select private.is_group_admin(id)));

create policy groups_delete on public.groups for delete to authenticated
  using ((select private.is_group_admin(id)));

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- group_members

alter table public.group_members enable row level security;
alter table public.group_members force  row level security;

create policy group_members_select on public.group_members for select to authenticated
  using ((select private.is_group_member(group_id)));

-- *** DELIBERATELY NO INSERT POLICY. ***
-- If you are adding one because a feature "needs" it: don't. The ONLY
-- door into a group is create_group() (creator becomes admin) and
-- join_group_by_invite() (006_group_rpcs.sql), both SECURITY DEFINER.
-- A client-facing INSERT policy here -- even one gated by
-- is_group_member(group_id) -- lets any member add ANYONE to the group,
-- and worse, lets a user add THEMSELVES to any group whose id they can
-- guess or enumerate, bypassing the invite code entirely.
-- pgTAP test #5 (see supabase/tests/) asserts this policy count stays at
-- what this migration leaves it, precisely to catch that PR.

create policy group_members_update on public.group_members for update to authenticated
  using ((select private.is_group_admin(group_id)))
  with check ((select private.is_group_admin(group_id)));

-- A member can remove themselves (leave); an admin can remove anyone.
create policy group_members_delete on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_group_admin(group_id)));
