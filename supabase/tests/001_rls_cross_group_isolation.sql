-- 001_rls_cross_group_isolation.sql
-- Test #1 and #2 from the design plan: catalog-driven proof that every
-- table in `public` (a) has RLS enabled with at least one policy, and
-- (b) returns zero rows to a non-member / unauthenticated caller. This
-- is deliberately catalog-driven so it does NOT rot when a new table is
-- added without a policy -- the new table is picked up automatically
-- and the test fails loudly instead of silently passing.

begin;
select plan(3);

-- ---------------------------------------------------------------------
-- Test 1: every table in `public` (excluding pgTAP's own scratch state)
-- has row_security enabled.
-- ---------------------------------------------------------------------
select is(
  (
    select count(*)::int
    from pg_tables t
    join pg_class c on c.relname = t.tablename
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = t.schemaname
    where t.schemaname = 'public'
      and not c.relrowsecurity
  ),
  0,
  'every table in public has row level security enabled'
);

-- ---------------------------------------------------------------------
-- Test 2: every table in `public` has at least one policy defined.
-- Catches a table that has ENABLE ROW LEVEL SECURITY but no CREATE
-- POLICY, which (correctly) blocks everyone including legitimate
-- members -- a functional bug, not a security one, but still a bug
-- this suite should catch before it ships.
-- ---------------------------------------------------------------------
select is(
  (
    select count(*)::int
    from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = t.schemaname and p.tablename = t.tablename
      )
  ),
  0,
  'every table in public has at least one RLS policy'
);

-- ---------------------------------------------------------------------
-- Test 3: with no identity set (anon / unauthenticated), every table
-- returns zero rows. Iterates the catalog so a newly added table is
-- covered automatically.
--
-- IMPORTANT: this test is only meaningful when the pgTAP runner
-- connects as a role that is actually subject to RLS -- `authenticated`
-- or `anon`, never a superuser/table-owner role (`postgres`,
-- `supabase_admin`). A superuser bypasses RLS unconditionally,
-- regardless of what `request.jwt.claims`/`role` GUCs are set to, which
-- would make this test pass even if every policy were broken. `SET
-- ROLE authenticated` (not `set_config('role', ...)`, which does not
-- actually switch the executing role) is what pgTAP's own
-- `runtests.sql` / `supabase test db` driver does under the hood.
-- ---------------------------------------------------------------------
do $$
declare
  v_table   text;
  v_count   bigint;
  v_leaked  text[] := '{}';
begin
  perform set_config('request.jwt.claims', '', true);
  set local role authenticated;

  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('select count(*) from public.%I', v_table) into v_count;
    if v_count <> 0 then
      v_leaked := array_append(v_leaked, v_table || ' (' || v_count || ' rows)');
    end if;
  end loop;

  reset role;

  if array_length(v_leaked, 1) is not null then
    raise exception 'tables visible with no identity set: %', array_to_string(v_leaked, ', ');
  end if;
end $$;

select pass('no table in public returns rows when no identity is set');

select * from finish();
rollback;
