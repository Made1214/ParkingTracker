-- 025_account_group_deletion.sql
-- API §3.2 (delete group) and RNF-12 (delete account): the RPCs delete
-- the rows and hand every Cloudinary public_id back to the caller.
begin;
select plan(24);

-- ── delete_my_account: anonymization when expenses block deletion ───
-- Runs before delete_group below removes the seeded group that holds
-- this account's expense history.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
update public.profiles
set avatar_public_id = 'profiles/00000000-0000-0000-0000-000000000004/66666666-6666-4666-8666-666666666666'
where id = '00000000-0000-0000-0000-000000000004';
set local role authenticated;
select lives_ok(
  $$select set_config('test.anonymized_account',
      (select row_to_json(d)::text from public.delete_my_account() d), true)$$,
  'an account with expense history is anonymized');
reset role;
select is(
  (select display_name from public.profiles where id='00000000-0000-0000-0000-000000000004'),
  'Cuenta eliminada', 'the profile is anonymized instead of deleted');
select is(
  (select avatar_public_id from public.profiles where id='00000000-0000-0000-0000-000000000004'),
  null, 'the anonymized profile keeps no avatar reference');
select is(
  (select email from auth.users where id='00000000-0000-0000-0000-000000000004'),
  'deleted-00000000-0000-0000-0000-000000000004@deleted.invalid',
  'the auth identity is scrubbed');
select is(
  (select banned_until from auth.users where id='00000000-0000-0000-0000-000000000004'),
  'infinity'::timestamptz, 'the auth account can no longer sign in');
select is(
  current_setting('test.anonymized_account')::jsonb ->> 'deleted_avatar_public_id',
  'profiles/00000000-0000-0000-0000-000000000004/66666666-6666-4666-8666-666666666666',
  'the anonymized avatar is still returned for cleanup');

-- ── delete_group ────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.delete_group('10000000-0000-0000-0000-000000000001')$$,
  '42501', 'not authorized', 'a member cannot delete the group');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select set_config('test.group_assets',
      array_to_json(public.delete_group('10000000-0000-0000-0000-000000000001'))::text, true)$$,
  'an admin deletes the group');
reset role;
select is_empty(
  $$select id from public.groups where id='10000000-0000-0000-0000-000000000001'$$,
  'group row is gone');
select is_empty(
  $$select id from public.events where group_id='10000000-0000-0000-0000-000000000001'$$,
  'every event of the group is gone');
select is_empty(
  $$select user_id from public.group_members where group_id='10000000-0000-0000-0000-000000000001'$$,
  'every membership of the group is gone');
select is(
  (select count(*)::int from jsonb_array_elements_text(current_setting('test.group_assets')::jsonb)),
  4, 'delete_group returns every group photo for Cloudinary cleanup');
select is(
  (select array_agg(value order by value)
   from jsonb_array_elements_text(current_setting('test.group_assets')::jsonb)),
  array['parking-tracker/dev/seed-photo-1','parking-tracker/dev/seed-photo-2',
        'parking-tracker/dev/seed-photo-3','parking-tracker/dev/seed-photo-4']::text[],
  'the returned assets are the seeded photos');

-- ── delete_my_account: successor, solo group, hard delete ───────────
reset role;
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'dana@example.com', '', now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Dana Fixture"}', now(), now()
);
update public.profiles
set avatar_public_id = 'profiles/00000000-0000-0000-0000-0000000000a1/11111111-1111-4111-8111-111111111111'
where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.groups (id, name, invite_code, created_by, avatar_public_id) values
  ('10000000-0000-0000-0000-0000000000a1', 'Grupo compartido', 'TSTA0001',
   '00000000-0000-0000-0000-0000000000a1',
   'groups/10000000-0000-0000-0000-0000000000a1/22222222-2222-4222-8222-222222222222'),
  ('10000000-0000-0000-0000-0000000000a2', 'Grupo en solitario', 'TSTA0002',
   '00000000-0000-0000-0000-0000000000a1',
   'groups/10000000-0000-0000-0000-0000000000a2/33333333-3333-4333-8333-333333333333');
insert into public.group_members (group_id, user_id, role, joined_at) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'admin',  now() - interval '10 days'),
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000005', 'member', now() - interval '5 days'),
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000006', 'member', now() - interval '2 days'),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'admin',  now() - interval '10 days');

insert into public.events (
  id, group_id, title, starts_at, ends_at, status, created_by, cover_public_id
) values (
  '20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a2',
  'Salida de prueba', now() + interval '1 day', now() + interval '2 days', 'published',
  '00000000-0000-0000-0000-0000000000a1',
  'events/10000000-0000-0000-0000-0000000000a2/20000000-0000-0000-0000-0000000000a2/44444444-4444-4444-8444-444444444444');
insert into public.photos (
  id, group_id, event_id, cloudinary_public_id, bytes, uploaded_by
) values (
  '30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a2',
  '20000000-0000-0000-0000-0000000000a2', 'parking-tracker/dev/fixture-photo', 1024,
  '00000000-0000-0000-0000-0000000000a1');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select set_config('test.account_deletion',
      (select row_to_json(d)::text from public.delete_my_account() d), true)$$,
  'the user deletes their own account');
reset role;
select is(
  (select role from public.group_members
   where group_id='10000000-0000-0000-0000-0000000000a1'
     and user_id='00000000-0000-0000-0000-000000000005'),
  'admin', 'the earliest joined member becomes the group admin');
select is(
  (select role from public.group_members
   where group_id='10000000-0000-0000-0000-0000000000a1'
     and user_id='00000000-0000-0000-0000-000000000006'),
  'member', 'later members keep their role');
select is_empty(
  $$select user_id from public.group_members where user_id='00000000-0000-0000-0000-0000000000a1'$$,
  'the deleted account leaves every membership');
select is_empty(
  $$select id from public.groups where id='10000000-0000-0000-0000-0000000000a2'$$,
  'a group whose only member leaves is deleted');
select is_empty(
  $$select id from public.profiles where id='00000000-0000-0000-0000-0000000000a1'$$,
  'the profile is deleted when no expense history blocks it');
select is_empty(
  $$select id from auth.users where id='00000000-0000-0000-0000-0000000000a1'$$,
  'the auth user is deleted when no expense history blocks it');
select is(
  current_setting('test.account_deletion')::jsonb ->> 'deleted_avatar_public_id',
  'profiles/00000000-0000-0000-0000-0000000000a1/11111111-1111-4111-8111-111111111111',
  'the profile avatar is returned for cleanup');
select is(
  (select array_agg(value order by value)
   from jsonb_array_elements_text(
     current_setting('test.account_deletion')::jsonb -> 'deleted_group_avatars')),
  array['groups/10000000-0000-0000-0000-0000000000a2/33333333-3333-4333-8333-333333333333']::text[],
  'only the deleted solo group contributes its avatar');
select is(
  (select array_agg(value order by value)
   from jsonb_array_elements_text(
     current_setting('test.account_deletion')::jsonb -> 'deleted_event_covers')),
  array['events/10000000-0000-0000-0000-0000000000a2/20000000-0000-0000-0000-0000000000a2/44444444-4444-4444-8444-444444444444']::text[],
  'the deleted group events contribute their covers');
select is(
  (select array_agg(value order by value)
   from jsonb_array_elements_text(
     current_setting('test.account_deletion')::jsonb -> 'deleted_photos')),
  array['parking-tracker/dev/fixture-photo']::text[],
  'the deleted group photos are returned for cleanup');

select * from finish();
rollback;
