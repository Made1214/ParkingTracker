-- 007_canary_dropped_policy.sql
-- The E1.F2.T5 acceptance criterion, made literal: drop a real policy
-- inside this test transaction and prove that 001_rls_cross_group_isolation's
-- catalog check would catch it. This does NOT permanently weaken
-- anything -- it runs inside BEGIN/ROLLBACK, so the dropped policy is
-- restored the instant this file finishes. Its purpose is to prove the
-- suite itself has teeth, not to test the schema.

begin;
select plan(2);

-- Baseline: before the canary, events has policies (sanity check the
-- premise is even meaningful).
select ok(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'events') > 0,
  'baseline: events has RLS policies before the canary drop'
);

-- Drop every policy on `events` inside this transaction only.
drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;

-- This is the assertion that proves the suite has teeth: the exact
-- catalog check from 001_rls_cross_group_isolation's Test 2 now finds
-- events with zero policies. If this assertion ever silently passed
-- when policies were dropped, THAT would be the real failure -- so this
-- test intentionally inverts is() to confirm the canary is detectable.
select is(
  (
    select count(*)::int
    from pg_tables t
    where t.schemaname = 'public'
      and t.tablename = 'events'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = t.schemaname and p.tablename = t.tablename
      )
  ),
  1,
  'canary: with events'' policies dropped, the catalog check correctly flags it as unprotected'
);

select * from finish();
rollback;  -- restores the dropped policies; nothing here persists
