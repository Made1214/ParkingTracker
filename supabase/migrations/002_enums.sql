-- 002_enums.sql
-- The 6 domain enums (Doc 04). Native enums, not text+CHECK: the closed
-- set of statuses is stable for the MVP and gen types produces exact
-- TypeScript union types from them.

create type public.member_role       as enum ('admin', 'member');
create type public.event_status      as enum ('draft', 'published', 'cancelled', 'finished');
create type public.attendance_status as enum ('going', 'maybe', 'declined');
create type public.proposal_status   as enum ('open', 'accepted', 'rejected');
create type public.poll_status       as enum ('open', 'closed');
create type public.task_status       as enum ('pending', 'in_progress', 'done');
