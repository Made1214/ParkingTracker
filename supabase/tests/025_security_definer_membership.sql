-- 025_security_definer_membership.sql
-- Verifies that every SECURITY DEFINER function callable via the API
-- rejects non-members (or relevant abuse cases for group creation/joining).
-- Covers the 8 public SECURITY DEFINER RPCs:
--   1. public.create_group(text, text)
--   2. public.join_group_by_invite(text)
--   3. public.create_activity_proposal(uuid, text, text)
--   4. public.review_activity_proposal(uuid, public.proposal_status)
--   5. public.create_poll(uuid, text, text[], boolean, timestamptz)
--   6. public.cast_vote(uuid, uuid[])
--   7. public.close_poll(uuid)
--   8. public.settle_event_debt(uuid, uuid, uuid)
-- Plus private.can_manage_schedule(uuid) returning false for a non-member.

begin;
select plan(9);

-- Outsider account with no membership in the seeded group.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '99999999-0000-0000-0000-000000000077',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'outsider-rpc@example.com',
  crypt('devpassword', gen_salt('bf')),
  now(),
  now(),
  now()
) on conflict (id) do nothing;

-- Seed an open poll and an open proposal on the published event ('20000000-0000-0000-0000-000000000001')
-- as a legitimate member first so the RPCs have live targets to reject the outsider on.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select public.create_activity_proposal(
  '20000000-0000-0000-0000-000000000001',
  'Propuesta para test RPC',
  'Descripción'
);

select public.create_poll(
  '20000000-0000-0000-0000-000000000001',
  'Encuesta para test RPC',
  array['Opción 1', 'Opción 2'],
  false,
  now() + interval '2 days'
);

-- 1. create_group: rejects unauthenticated / missing JWT sub abuse case.
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$ select public.create_group('Grupo fantasma', null) $$,
  '42501',
  'not authenticated',
  'create_group rejects callers without an authenticated user id'
);

-- Switch to the authenticated outsider (not a member of group 1).
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000077","role":"authenticated"}', true);

-- 2. join_group_by_invite: rejects unknown/guessed invite code.
select throws_ok(
  $$ select public.join_group_by_invite('BADCODE9') $$,
  'P0002',
  'invalid invite code',
  'join_group_by_invite rejects an invalid invite code'
);

-- 3. create_activity_proposal: rejects non-member of the event's group.
select throws_ok(
  $$ select public.create_activity_proposal(
       '20000000-0000-0000-0000-000000000001',
       'Intruso propone',
       'No debería pasar'
     ) $$,
  '42501',
  null,
  'create_activity_proposal rejects a non-member'
);

-- 4. review_activity_proposal: rejects non-member of the event's group.
reset role;
create temporary table rpc_targets as
select
  (select id from public.activity_proposals where event_id = '20000000-0000-0000-0000-000000000001' limit 1) as proposal_id,
  (select id from public.polls where event_id = '20000000-0000-0000-0000-000000000001' limit 1) as poll_id,
  (select o.id from public.poll_options o join public.polls p on p.id = o.poll_id where p.event_id = '20000000-0000-0000-0000-000000000001' limit 1) as option_id;
set local role authenticated;

select throws_ok(
  $$ select public.review_activity_proposal((select proposal_id from rpc_targets), 'accepted') $$,
  '42501',
  null,
  'review_activity_proposal rejects a non-member'
);

-- 5. create_poll: rejects non-member of the event's group.
select throws_ok(
  $$ select public.create_poll(
       '20000000-0000-0000-0000-000000000001',
       'Encuesta intrusa',
       array['Sí', 'No'],
       false,
       now() + interval '1 day'
     ) $$,
  '42501',
  null,
  'create_poll rejects a non-member'
);

-- 6. cast_vote: rejects non-member of the poll's group.
select throws_ok(
  $$ select public.cast_vote((select poll_id from rpc_targets), array[(select option_id from rpc_targets)]) $$,
  '42501',
  null,
  'cast_vote rejects a non-member'
);

-- 7. close_poll: rejects non-member of the poll's group.
select throws_ok(
  $$ select public.close_poll((select poll_id from rpc_targets)) $$,
  '42501',
  null,
  'close_poll rejects a non-member'
);

-- 8. settle_event_debt: rejects non-member of the event's group.
select throws_ok(
  $$ select public.settle_event_debt(
       '20000000-0000-0000-0000-000000000004',
       '00000000-0000-0000-0000-000000000003',
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '42501',
  null,
  'settle_event_debt rejects a non-member'
);

-- 9. private.can_manage_schedule: returns false for a non-member.
select is(
  private.can_manage_schedule('20000000-0000-0000-0000-000000000001'),
  false,
  'can_manage_schedule returns false for a non-member'
);

select * from finish();
rollback;
