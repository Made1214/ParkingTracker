begin;
select plan(5);

-- Confirma las garantías efectivas del catálogo tras ejecutar las migraciones.
select is(
  (select count(*) from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     and not (c.relrowsecurity and c.relforcerowsecurity)),
  0::bigint, 'every public table enables and forces RLS');

select results_eq(
  $$select tablename::text collate "C" from pg_policies where schemaname = 'public'
    and policyname = 'current_member_delete_guard' and permissive = 'RESTRICTIVE'
    and cmd = 'DELETE' and roles = array['authenticated']::name[] order by 1$$,
  $$select unnest(array[
    'activity_proposals','comments','event_attendance','event_guests','events',
    'expense_guest_shares','expense_splits','expenses','photos','poll_options',
    'poll_votes','polls','receipts','schedule_items','tasks'
  ])::text collate "C"$$, 'all group content requires current membership to delete');

select results_eq(
  $$select (n.nspname || '.' || p.proname)::text collate "C" from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef order by 1$$,
  $$select unnest(array[
    'private.active_profile','private.can_manage_schedule','private.close_event_polls',
    'private.enforce_photo_quota','private.guard_membership_changes','private.handle_new_user',
    'private.is_group_admin','private.is_group_member','private.release_photo_quota',
    'private.shares_group_with','public.cast_vote','public.claim_task','public.close_poll',
    'public.create_activity_proposal','public.create_group','public.create_poll',
    'public.delete_event_draft','public.delete_group','public.delete_my_account',
    'public.get_invite_preview','public.is_username_available','public.join_group_by_invite',
    'public.reopen_receipt','public.review_activity_proposal','public.settle_event_debt',
    'public.update_manual_expense'
  ])::text collate "C"$$, 'only the documented functions have definer privileges');

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""']::text[], false)),
  0::bigint, 'definer functions have an empty search path');

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint, 'anonymous callers cannot execute definer functions');

select * from finish();
rollback;
