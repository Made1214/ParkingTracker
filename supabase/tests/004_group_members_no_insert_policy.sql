-- 004_group_members_no_insert_policy.sql
-- Test #5 from the design plan. group_members deliberately has NO
-- INSERT policy -- the only doors are create_group() and
-- join_group_by_invite(), both SECURITY DEFINER. If a future PR adds
-- one to "fix" a feature, this test forces that PR to touch this file,
-- which is the whole point: it cannot slip in silently.

begin;
select plan(2);

select is(
  (
    select count(*)::int
    from pg_policies
    where schemaname = 'public'
      and tablename = 'group_members'
      and cmd = 'INSERT'
  ),
  0,
  'group_members has zero INSERT policies -- the RPCs are the only door'
);

-- Even a legitimate member cannot insert directly, proving the absence
-- of a policy actually blocks the write (not just "no policy found" in
-- the catalog, but an observed rejection).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.group_members (group_id, user_id, role)
     values ('10000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000000001', 'admin') $$,
  '42501',
  null,
  'a direct INSERT into group_members is rejected even by an existing member'
);

select * from finish();
rollback;
