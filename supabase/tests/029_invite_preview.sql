-- 029_invite_preview.sql
-- public.get_invite_preview(text): an outsider holding the invite code
-- sees the group's name and size, nothing else; a wrong code returns no
-- row; anonymous callers are rejected; members are told they belong.
begin;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '99999999-0000-0000-0000-000000000088',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'outsider-invite@example.com',
  crypt('devpassword', gen_salt('bf')), now(), now(), now()
) on conflict (id) do nothing;

-- Real member count, read before RLS applies (the outsider cannot see it).
create temp table expected_members on commit drop as
  select count(*)::integer as n from public.group_members
   where group_id = '10000000-0000-0000-0000-000000000001';
grant select on expected_members to authenticated;

set local role authenticated;

-- Anonymous callers are rejected even with a valid code.
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$ select * from public.get_invite_preview('DEV00001') $$,
  '42501',
  'not authenticated',
  'anonymous callers cannot preview an invite'
);

-- An outsider with the code sees the group but is not a member.
select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000088","role":"authenticated"}', true);
select is(
  (select name from public.get_invite_preview('DEV00001')),
  'Los de siempre',
  'an outsider with the code sees the group name'
);
select is(
  (select already_member from public.get_invite_preview('dev00001 ')),
  false,
  'the code is case- and space-insensitive and the outsider is not a member'
);
select is(
  (select member_count from public.get_invite_preview('DEV00001')),
  (select n from expected_members),
  'member_count matches the real membership'
);
select is_empty(
  $$ select * from public.get_invite_preview('BADCODE9') $$,
  'an unknown code returns nothing'
);
-- The preview does not open the group itself to the outsider.
select is_empty(
  $$ select id from public.groups where invite_code = 'DEV00001' $$,
  'RLS still hides the group row from the outsider'
);

-- A member is told they already belong.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  (select already_member from public.get_invite_preview('DEV00001')),
  true,
  'a member is told they already belong'
);

select * from finish();
rollback;
