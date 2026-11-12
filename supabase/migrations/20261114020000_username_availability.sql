-- 20261114020000_username_availability.sql
-- Sprint plan E2.F3.T2: tell the user, while typing, whether a username is
-- free.
--
-- profiles RLS only exposes your own profile and those of people who share
-- a group with you, so the check needs definer rights. It returns a single
-- boolean for one candidate: no ids, names or lists, i.e. exactly what the
-- unique-violation error already reveals when saving. The app calls it
-- through a server action (a POST), so it counts toward the 60/min
-- mutation limit in src/proxy.ts.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
     and lower(trim(p_username)) ~ '^[a-z0-9_]{3,24}$'
     and not exists (
       select 1 from public.profiles p
        where p.username = lower(trim(p_username))
          and p.id <> (select auth.uid())
     );
$$;

revoke all on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;
