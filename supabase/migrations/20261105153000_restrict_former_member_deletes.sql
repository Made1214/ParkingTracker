-- SELECT policies do not constrain a DELETE without a WHERE/RETURNING clause.
-- Ownership is not enough once the author no longer belongs to the tenant.
do $$
declare target text;
begin
  foreach target in array array[
    'events', 'event_attendance', 'schedule_items', 'activity_proposals',
    'polls', 'poll_options', 'poll_votes', 'expenses', 'expense_splits',
    'tasks', 'photos', 'comments'
  ] loop
    execute format(
      'create policy current_member_delete_guard on public.%I as restrictive for delete to authenticated using ((select private.is_group_member(group_id)))',
      target
    );
  end loop;
end;
$$;
