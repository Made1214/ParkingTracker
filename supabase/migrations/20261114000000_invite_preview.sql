-- 20261114000000_invite_preview.sql
-- Sprint plan E3.F2.T1: /join/[code] shows the group before accepting.
--
-- A person who opens an invite link is not a member yet, so RLS hides the
-- group from them. This function returns only what someone holding the
-- invite code needs to decide: the group's name, description, member
-- count and whether they already belong to it. It never returns the
-- member list, events or any other group content, and the code is the
-- same secret that already lets them join (`join_group_by_invite`).
--
-- STABLE + SECURITY DEFINER with an empty search_path and qualified
-- names, like the other RPCs in supabase/SECURITY_DEFINER.md. Mutations
-- are rate-limited in the app proxy; reads of this function are not, but
-- the 8-character code space (36^8) makes guessing impractical.
create or replace function public.get_invite_preview(p_code text)
returns table (
  group_id uuid,
  name text,
  description text,
  member_count integer,
  already_member boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return query
  select
    g.id,
    g.name,
    g.description,
    (select count(*)::integer
       from public.group_members m
      where m.group_id = g.id),
    exists (
      select 1 from public.group_members m
       where m.group_id = g.id and m.user_id = v_user_id
    )
  from public.groups g
  where g.invite_code = upper(trim(p_code));
end;
$$;

revoke all on function public.get_invite_preview(text) from public, anon;
grant execute on function public.get_invite_preview(text) to authenticated;
