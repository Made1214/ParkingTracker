-- 003_helper_functions.sql
-- The authorization primitives every RLS policy in this schema reduces to.
-- Must exist before any policy that calls them.

-- is_group_member / is_group_admin are SECURITY DEFINER because the
-- group_members SELECT policy would otherwise have to read group_members
-- to evaluate itself -> 42P17 infinite recursion detected in policy.
-- The definer function runs as its owner and is not subject to RLS on
-- its own read, breaking the cycle.
--
-- set search_path = '' is mandatory: without it, a caller could set their
-- own search_path to shadow public.group_members with an attacker-owned
-- table and have this elevated function read it instead -- a privilege
-- escalation to full cross-tenant bypass, not a style preference.
--
-- (select auth.uid()) instead of auth.uid() forces the planner to build
-- an InitPlan and evaluate once per statement instead of once per row.

create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id  = (select auth.uid())
      and (select auth.uid()) is not null
  );
$$;

create or replace function private.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id  = (select auth.uid())
      and gm.role     = 'admin'
      and (select auth.uid()) is not null
  );
$$;

-- Used by the profiles SELECT policy: "may I see this other profile?"
-- Answer: yes if we share at least one group. Prevents profiles from
-- being readable platform-wide (using (true)), which would leak every
-- user's display name and avatar to every other user.
create or replace function private.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = (select auth.uid())
      and gm2.user_id = p_user_id
      and (select auth.uid()) is not null
  );
$$;

revoke execute on function private.is_group_member(uuid)   from public, anon;
revoke execute on function private.is_group_admin(uuid)    from public, anon;
revoke execute on function private.shares_group_with(uuid) from public, anon;
grant  execute on function private.is_group_member(uuid)   to authenticated;
grant  execute on function private.is_group_admin(uuid)    to authenticated;
grant  execute on function private.shares_group_with(uuid) to authenticated;

-- Generic updated_at trigger, applied to profiles/events/comments/etc.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Makes group_id immutable on every group-scoped table. Without this, a
-- member could UPDATE ... SET group_id = <other group> and walk a row
-- between tenants -- the composite FK blocks an *incoherent* target, but
-- this is the explicit statement of intent (Postgres has no declarative
-- immutable-column constraint).
create or replace function private.reject_group_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'group_id is immutable (row %)', old.id using errcode = '42501';
  end if;
  return new;
end;
$$;
