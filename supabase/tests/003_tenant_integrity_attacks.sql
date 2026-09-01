-- 003_tenant_integrity_attacks.sql
-- The attack angle plain group_id RLS policies cannot see: inserting a
-- child row with a group_id that matches the caller's own membership,
-- but an event_id that belongs to a DIFFERENT group. The composite FK
-- against events(id, group_id) must reject this with 23503.

begin;
select plan(5);

-- A second group + event, disjoint from the seeded "Los de siempre".
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('99999999-0000-0000-0000-000000000098', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'attacker@example.com', crypt('devpassword', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

-- Bootstrap group B and its membership as the migration owner (bypassing
-- RLS deliberately here, since this is fixture setup, not the thing
-- under test).
insert into public.groups (id, name, invite_code, created_by)
values ('10000000-0000-0000-0000-00000000000b', 'Grupo B', 'ATCK0001', '99999999-0000-0000-0000-000000000098')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role)
values ('10000000-0000-0000-0000-00000000000b', '99999999-0000-0000-0000-000000000098', 'admin')
on conflict do nothing;

-- Now act as the attacker: a real member of group B.
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000098","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) from public.groups where id = '10000000-0000-0000-0000-00000000000b') = 1,
  'attacker is a legitimate member of group B (sanity check)'
);

-- Attack: insert a comment with group_id = B (legitimate membership,
-- passes is_group_member) but event_id pointing at group A's seeded
-- "Noche de trivia" event. Every column-level RLS check individually
-- passes; only the composite FK sees the mismatch.
select throws_ok(
  $$ insert into public.comments (group_id, event_id, body, author_id)
     values ('10000000-0000-0000-0000-00000000000b',
             '20000000-0000-0000-0000-000000000004',
             'tenant-crossing comment', '99999999-0000-0000-0000-000000000098') $$,
  '23503',
  null,
  'comment with group_id=B but event_id from group A is rejected by the composite FK'
);

-- Same attack against expenses (the higher-stakes case: money).
select throws_ok(
  $$ insert into public.expenses (group_id, event_id, description, amount, paid_by, created_by)
     values ('10000000-0000-0000-0000-00000000000b',
             '20000000-0000-0000-0000-000000000004',
             'tenant-crossing expense', 100.00,
             '99999999-0000-0000-0000-000000000098',
             '99999999-0000-0000-0000-000000000098') $$,
  '23503',
  null,
  'expense with group_id=B but event_id from group A is rejected by the composite FK'
);

-- Attacker (member of B, not A) tries to move Ana's group_members row
-- from group A to group B. Rejected by RLS (group_members_update
-- requires is_group_admin on the row's CURRENT group_id, and the
-- attacker is not an admin of group A) -- group_members has no
-- group_id-immutability trigger of its own, so RLS is the only guard
-- here. An UPDATE whose USING clause matches zero rows is not an
-- error in Postgres (RLS narrows silently), so the correct proof is
-- 0 rows affected, not a thrown exception.
do $$
begin
  update public.group_members set group_id = '10000000-0000-0000-0000-00000000000b'
    where group_id = '10000000-0000-0000-0000-000000000001'
      and user_id = '00000000-0000-0000-0000-000000000001';
  if found then
    raise exception 'attacker moved another group''s membership row into their own tenant';
  end if;
end $$;

select pass('attacker cannot move another group''s membership row into their own tenant (0 rows affected)');

-- group_id immutability trigger, exercised directly on a table that
-- actually has it: an admin of B tries to walk their OWN event's
-- group_id to A. Needs a seeded event in B first.
insert into public.events (group_id, title, starts_at, ends_at, created_by)
values ('10000000-0000-0000-0000-00000000000b', 'Grupo B event', now(), now() + interval '1 hour',
        '99999999-0000-0000-0000-000000000098');

-- The trigger's RAISE EXCEPTION message interpolates the actual row id
-- (e.g. "group_id is immutable (row fd0aa8e3-...)"), so only the error
-- CODE is asserted here, not the literal message text.
select throws_ok(
  $$ update public.events set group_id = '10000000-0000-0000-0000-000000000001'
     where group_id = '10000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'the group_id-immutable trigger rejects reparenting an event to another tenant'
);

select * from finish();
rollback;
