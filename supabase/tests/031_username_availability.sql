-- 031_username_availability.sql
-- public.is_username_available(text): taken names are reported as taken
-- regardless of case or spaces, free and well-formed ones as free, your
-- own name as free for you, malformed names and anonymous callers as not.
begin;
select plan(7);

-- Ana (seed) owns the username "ana_t" (set as the table owner, before RLS).
update public.profiles set username = 'ana_t'
 where id = '00000000-0000-0000-0000-000000000001';

set local role authenticated;

select set_config('request.jwt.claims', '{}', true);
select is(public.is_username_available('libre_123'), false,
  'anonymous callers always get false');

-- Luis checks names.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(public.is_username_available('ana_t'), false,
  'a name someone else uses is taken');
select is(public.is_username_available('  ANA_T '), false,
  'case and surrounding spaces do not hide a taken name');
select is(public.is_username_available('luis_nuevo'), true,
  'a free, well-formed name is available');
select is(public.is_username_available('ab'), false,
  'a name shorter than 3 characters is not available');
select is(public.is_username_available('con espacio'), false,
  'a name with invalid characters is not available');

-- Ana keeping her own name is fine.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.is_username_available('ana_t'), true,
  'your own current name counts as available for you');

select * from finish();
rollback;
