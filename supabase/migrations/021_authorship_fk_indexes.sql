-- 021_authorship_fk_indexes.sql
-- Postgres does not auto-index foreign keys. These are the single-column
-- authorship/payer FKs the advisor flagged as unindexed -- cheap to add,
-- and they avoid a seq-scan on every cascading delete of a profile.
create index groups_created_by_idx             on public.groups (created_by);
create index events_created_by_idx              on public.events (created_by);
create index activity_proposals_created_by_idx  on public.activity_proposals (created_by);
create index schedule_items_created_by_idx      on public.schedule_items (created_by);
create index polls_created_by_idx               on public.polls (created_by);
create index expenses_created_by_idx            on public.expenses (created_by);
create index tasks_created_by_idx               on public.tasks (created_by);
create index photos_uploaded_by_idx             on public.photos (uploaded_by);
create index comments_author_id_idx             on public.comments (author_id);
