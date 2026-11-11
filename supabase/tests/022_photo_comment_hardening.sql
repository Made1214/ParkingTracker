-- 022_photo_comment_hardening.sql
-- Verifies database security hardening for gallery photos, event comments,
-- and the activity_proposals_insert InitPlan policy (findings 1.1–1.5, 8.1).

begin;
select plan(17);

-- Fixture: a second published event in the same group to test cross-event replies.
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by)
values (
  '90000000-0000-0000-0000-000000000041',
  '10000000-0000-0000-0000-000000000001',
  'Second published event',
  now() + interval '3 days',
  now() + interval '3 days 4 hours',
  'published',
  '00000000-0000-0000-0000-000000000001'
);

-- Act as Luis (member of group 1).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- 1.1: Photo cloudinary_public_id scope constraint.
select lives_ok(
  $$ insert into public.photos (id, group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '94000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  'member can register a photo scoped to the group and published event'
);

select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'photos/10000000-0000-0000-0000-000000000002/20000000-0000-0000-0000-000000000001/22222222-2222-4222-8222-222222222222',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  null,
  'photo public_id referencing another group is rejected'
);

select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/22222222-2222-4222-8222-222222222222',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  null,
  'photo public_id referencing another event is rejected'
);

-- 1.4: Photo positive dimension constraint.
select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000001/33333333-3333-4333-8333-333333333333',
       120000, 0, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  null,
  'photo with non-positive dimensions is rejected'
);

-- 1.5 (photos): Draft and cancelled events reject photo inserts; finished events allow them.
select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000002',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002/44444444-4444-4444-8444-444444444444',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  'photos require a published or finished event',
  'draft event rejects photo uploads'
);

select throws_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000003',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000003/55555555-5555-4555-8555-555555555555',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  'photos require a published or finished event',
  'cancelled event rejects photo uploads'
);

select lives_ok(
  $$ insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000004',
       'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/66666666-6666-4666-8666-666666666666',
       120000, 1200, 900, '00000000-0000-0000-0000-000000000002'
     ) $$,
  'finished event accepts photo uploads'
);

-- 1.2: Comment UPDATE restricted to body column and author only.
select lives_ok(
  $$ update public.comments set body = 'Comentario editado por su autor'
     where id = '50000000-0000-0000-0000-000000000002' $$,
  'author can update the body of their own comment'
);

select throws_ok(
  $$ update public.comments set author_id = '00000000-0000-0000-0000-000000000001'
     where id = '50000000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'author cannot update author_id on comments (column privilege revoked)'
);

select throws_ok(
  $$ update public.comments set event_id = '20000000-0000-0000-0000-000000000001'
     where id = '50000000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'author cannot update event_id on comments (column privilege revoked)'
);

select throws_ok(
  $$ update public.comments set parent_id = '50000000-0000-0000-0000-000000000001'
     where id = '50000000-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'author cannot update parent_id on comments (column privilege revoked)'
);

select is_empty(
  $$ update public.comments set body = 'Editado por otro miembro'
     where id = '50000000-0000-0000-0000-000000000001' returning id $$,
  'non-author member cannot update another member''s comment'
);

-- 1.3: Reply parent must belong to the same event and group.
select throws_ok(
  $$ insert into public.comments (group_id, event_id, parent_id, body, author_id)
     values (
       '10000000-0000-0000-0000-000000000001',
       '90000000-0000-0000-0000-000000000041',
       '50000000-0000-0000-0000-000000000001',
       'cross-event reply attempt',
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  'reply parent must belong to the same event and group',
  'reply pointing to a parent comment from another event is rejected'
);

-- 1.5 (comments): Draft and cancelled events reject comments.
select throws_ok(
  $$ insert into public.comments (group_id, event_id, body, author_id)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000002',
       'comment on draft event',
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  'comments require a published or finished event',
  'draft event rejects comments'
);

select throws_ok(
  $$ insert into public.comments (group_id, event_id, body, author_id)
     values (
       '10000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000003',
       'comment on cancelled event',
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '23514',
  'comments require a published or finished event',
  'cancelled event rejects comments'
);

-- Cancelled transition locks existing comments and photos against edits/deletes.
reset role;
update public.events set status = 'cancelled' where id = '20000000-0000-0000-0000-000000000004';
set local role authenticated;

select throws_ok(
  $$ update public.comments set body = 'Edited after cancel'
     where id = '50000000-0000-0000-0000-000000000002' $$,
  '23514',
  'comments require a published or finished event',
  'cancelled event blocks comment edits'
);

-- 8.1: Catalog check that activity_proposals_insert wraps auth.uid() in a subselect.
select ok(
  (
    select with_check like '%( SELECT auth.uid() AS uid)%'
        or with_check like '%(select auth.uid())%'
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_proposals'
      and policyname = 'activity_proposals_insert'
  ),
  'activity_proposals_insert evaluates auth.uid() via a scalar subquery'
);

select * from finish();
rollback;
