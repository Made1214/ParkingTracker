-- 006_domain_constraints.sql
-- PRD constraints, poll arity (including the DELETE 2->1 path flagged
-- as a risk in the design plan), and one-level comment nesting.

begin;
select plan(7);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

-- amount > 0
select throws_ok(
  $$ insert into public.expenses (group_id, event_id, description, amount, paid_by, created_by)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
             'invalid expense', 0, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'an expense with amount <= 0 fails the CHECK constraint'
);

-- ends_at > starts_at
select throws_ok(
  $$ insert into public.events (group_id, title, starts_at, ends_at, created_by)
     values ('10000000-0000-0000-0000-000000000001', 'time travel event',
             now(), now() - interval '1 hour', '00000000-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'an event with ends_at < starts_at fails the CHECK constraint'
);

-- photo > 10 MB
select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, uploaded_by)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
             'oversized-photo', 10485761, '00000000-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'a photo over 10 MB fails the CHECK constraint'
);

-- Poll arity: creating a poll with only 1 option fails once the
-- deferred constraint trigger is checked. A PL/pgSQL function is the
-- correct pgTAP vehicle for a multi-statement attempt (throws_ok takes
-- a single statement or a function call, not a raw multi-statement
-- string) -- and `set constraints all immediate` forces the deferred
-- trigger to fire inside the function instead of waiting for COMMIT.
create or replace function pg_temp.attempt_low_arity_poll()
returns void language plpgsql as $fn$
begin
  insert into public.polls (id, group_id, event_id, question, created_by)
    values ('30000000-0000-0000-0000-000000000099', '10000000-0000-0000-0000-000000000001',
            '20000000-0000-0000-0000-000000000004', 'Poll with 1 option', '00000000-0000-0000-0000-000000000001');
  insert into public.poll_options (group_id, poll_id, label)
    values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000099', 'Only option');
  set constraints all immediate;
end;
$fn$;

select throws_ok(
  'select pg_temp.attempt_low_arity_poll()',
  '23514',
  null,
  'a poll left with only 1 option fails the deferred arity check'
);

-- One-level comment nesting: a reply-to-a-reply is rejected.
select throws_ok(
  $$ insert into public.comments (group_id, event_id, parent_id, body, author_id)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
             '50000000-0000-0000-0000-000000000003',
             'reply to a reply, should fail', '00000000-0000-0000-0000-000000000001') $$,
  '23514',
  'comments support only one level of nesting',
  'a reply to an existing reply is rejected -- only one level of nesting allowed'
);

-- A reply to a ROOT comment is allowed (sanity check the trigger is not
-- over-broad and blocking legitimate replies).
select lives_ok(
  $$ insert into public.comments (group_id, event_id, parent_id, body, author_id)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
             '50000000-0000-0000-0000-000000000001',
             'a legitimate reply to a root comment', '00000000-0000-0000-0000-000000000001') $$,
  'a reply to a root comment is accepted'
);

-- Personal-record write with a foreign user_id is rejected (event_attendance).
select throws_ok(
  $$ insert into public.event_attendance (group_id, event_id, user_id, status)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
             '00000000-0000-0000-0000-000000000002', 'going') $$,
  '42501',
  null,
  'Ana cannot RSVP on Luis''s behalf -- personal-record write requires user_id = auth.uid()'
);

select * from finish();
rollback;
