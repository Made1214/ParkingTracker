-- Hallazgos de los advisors de Supabase (rendimiento). Sin cambios de comportamiento.

-- 1. `auth.uid()` dentro de una política se reevalúa por fila; envuelto en un
--    subselect se calcula una sola vez por sentencia. La condición es la misma
--    que dejó 026_proposal_poll_security.sql.
alter policy activity_proposals_insert on public.activity_proposals
  with check (
    private.is_group_member(group_id)
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = activity_proposals.event_id
        and e.group_id = activity_proposals.group_id
        and e.status not in ('finished', 'cancelled')
    )
  );

-- 2. Las claves foráneas compuestas de integridad de tenant (hijo -> padre con
--    `group_id`) no tenían un índice que las cubriera: borrar una salida o una
--    votación recorría cada tabla hija completa. Los índices de una sola
--    columna se sustituyen por el compuesto, que sirve igual para buscar por la
--    primera columna, así que no se acumulan índices redundantes.
create index activity_proposals_event_group_idx on public.activity_proposals (event_id, group_id);
drop index public.activity_proposals_event_id_idx;

create index comments_event_group_idx on public.comments (event_id, group_id);
drop index public.comments_event_id_idx;

create index event_attendance_event_group_idx on public.event_attendance (event_id, group_id);
drop index public.event_attendance_event_id_idx;

create index expenses_event_group_idx on public.expenses (event_id, group_id);
drop index public.expenses_event_id_idx;

create index expense_splits_expense_group_idx on public.expense_splits (expense_id, group_id);
drop index public.expense_splits_expense_id_idx;

create index photos_event_group_idx on public.photos (event_id, group_id);
drop index public.photos_event_id_idx;

create index polls_event_group_idx on public.polls (event_id, group_id);
drop index public.polls_event_id_idx;

create index poll_options_poll_group_idx on public.poll_options (poll_id, group_id);
drop index public.poll_options_poll_id_idx;

create index poll_votes_poll_group_idx on public.poll_votes (poll_id, group_id);
drop index public.poll_votes_poll_id_idx;

create index poll_votes_option_poll_idx on public.poll_votes (option_id, poll_id);
drop index public.poll_votes_option_id_idx;

create index tasks_event_group_idx on public.tasks (event_id, group_id);
drop index public.tasks_event_id_idx;

-- `schedule_items` conserva sus índices de orden (event_id, position…): el
-- cronograma se lee ordenado por ellos.
create index schedule_items_event_group_idx on public.schedule_items (event_id, group_id);
create index schedule_items_proposal_group_idx on public.schedule_items (proposal_id, group_id);
