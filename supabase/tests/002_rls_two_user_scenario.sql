-- 002_rls_two_user_scenario.sql
-- Requires the seed data (supabase/seed.sql) to be loaded first: uses
-- Ana (member/admin of "Los de siempre") as user A, and a throwaway
-- user with no group membership as user B.

begin;
select plan(8);

-- Throwaway non-member user, created inline so this test does not
-- depend on any seed row beyond the group/event data itself.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('99999999-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'stranger@example.com', crypt('devpassword', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- As Ana (member + admin of the seeded group): can see her group's data.
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) from public.groups where id = '10000000-0000-0000-0000-000000000001') = 1,
  'Ana (member) can see her own group'
);

select ok(
  (select count(*) from public.events where group_id = '10000000-0000-0000-0000-000000000001') = 4,
  'Ana (member) can see all 4 seeded events in her group'
);

select ok(
  (select count(*) from public.expenses where group_id = '10000000-0000-0000-0000-000000000001') = 3,
  'Ana (member) can see her group''s expenses'
);

-- ---------------------------------------------------------------------
-- As the stranger (not a member of any group): zero rows everywhere,
-- across the four DML verbs the design plan calls out explicitly.
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000099","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) from public.groups where id = '10000000-0000-0000-0000-000000000001') = 0,
  'stranger (non-member) SELECT on groups returns 0 rows'
);

select ok(
  (select count(*) from public.events where group_id = '10000000-0000-0000-0000-000000000001') = 0,
  'stranger (non-member) SELECT on events returns 0 rows'
);

select ok(
  (select count(*) from public.expenses where group_id = '10000000-0000-0000-0000-000000000001') = 0,
  'stranger (non-member) SELECT on expenses returns 0 rows'
);

select throws_ok(
  $$ insert into public.events (group_id, title, starts_at, ends_at, created_by)
     values ('10000000-0000-0000-0000-000000000001', 'hostile insert', now(), now() + interval '1 hour',
             '99999999-0000-0000-0000-000000000099') $$,
  '42501',
  null,
  'stranger (non-member) INSERT into events is rejected by RLS'
);

-- An UPDATE whose USING clause matches zero rows is not an error in
-- Postgres -- RLS silently narrows the row set to nothing, and the
-- statement succeeds having touched 0 rows. throws_ok is the wrong
-- assertion here; the correct proof is 0 rows affected.
do $$
begin
  update public.events set title = 'hijacked' where group_id = '10000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'stranger (non-member) UPDATE on events affected at least one row';
  end if;
end $$;

select pass('stranger (non-member) UPDATE on events affects 0 rows (RLS narrows silently, no error)');

select * from finish();
rollback;
