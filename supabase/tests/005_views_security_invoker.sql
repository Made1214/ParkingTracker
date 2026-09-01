-- 005_views_security_invoker.sql
-- Test #4 from the design plan. Catalog-driven so a future view without
-- security_invoker=true is caught automatically -- a view created by
-- the migration owner without this option silently bypasses RLS
-- (Postgres views default to running as their owner, who owns every
-- table). Supabase ships an ERROR-level advisor lint for exactly this.

begin;
select plan(2);

select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and coalesce(
        (select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'),
        'false'
      ) <> 'true'
  ),
  0,
  'every view in public has security_invoker = true'
);

-- Behavioral proof, not just the catalog flag: a non-member of the
-- seeded group gets zero rows through member_participation, exactly as
-- they would querying group_members directly. Each test file runs and
-- rolls back independently, so the stranger user is (re)inserted here
-- rather than assumed to exist from another file.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('99999999-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'stranger-views@example.com', crypt('devpassword', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

select set_config('request.jwt.claims', '{"sub":"99999999-0000-0000-0000-000000000099","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.member_participation where group_id = '10000000-0000-0000-0000-000000000001'),
  0,
  'a non-member sees zero rows through member_participation (security_invoker enforces RLS, not just the flag)'
);

select * from finish();
rollback;
