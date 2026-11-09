begin;
select plan(4);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$
  insert into public.events(id, group_id, title, starts_at, ends_at, status, created_by)
  values ('90000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001',
    'Draft', now() + interval '1 day', now() + interval '2 days', 'draft',
    '00000000-0000-0000-0000-000000000002')
$$, 'a member can create a draft');
select results_eq($$update public.events set title = 'Draft updated' where id = '90000000-0000-0000-0000-000000000012' returning title$$,
  $$values ('Draft updated'::text)$$, 'the creator can edit the draft');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is_empty($$update public.events set status = 'published' where id = '90000000-0000-0000-0000-000000000012' returning id$$,
  'another member cannot publish the draft');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select results_eq($$update public.events set status = 'published' where id = '90000000-0000-0000-0000-000000000012' returning status::text$$,
  $$values ('published'::text)$$, 'the creator can publish the draft');

select * from finish();
rollback;
