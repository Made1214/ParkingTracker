-- 020_force_rls.sql
-- FORCE is redundant for the app path (app_user/authenticated are never
-- table owners, so ENABLE already applies to them). It exists to protect
-- the OTHER paths: a migration script, a psql session, a cron job, or a
-- SECURITY DEFINER function's owner -- all of which are `postgres` and
-- would otherwise bypass RLS as table owner.
--
-- Verified empirically against this project before writing this file:
-- FORCE ROW LEVEL SECURITY does NOT break the is_group_member/
-- is_group_admin SECURITY DEFINER helpers (they still returned the
-- correct result under FORCE). Isolated in its own migration file so it
-- has a clean, single-statement rollback boundary if that ever changes.

alter table public.profiles              force row level security;
alter table public.groups                force row level security;
alter table public.group_members         force row level security;
alter table public.events                force row level security;
alter table public.event_attendance      force row level security;
alter table public.schedule_items        force row level security;
alter table public.activity_proposals    force row level security;
alter table public.polls                 force row level security;
alter table public.poll_options          force row level security;
alter table public.poll_votes            force row level security;
alter table public.expenses              force row level security;
alter table public.expense_splits        force row level security;
alter table public.tasks                 force row level security;
alter table public.photos                force row level security;
alter table public.group_storage_usage   force row level security;
alter table public.comments              force row level security;
