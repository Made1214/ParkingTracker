-- 20261114010000_event_cancel_reason.sql
-- Sprint plan E4.F1.T4: cancelling an event takes an optional reason that
-- the whole group sees.
--
-- private.guard_event_changes already allows published → cancelled only
-- before the start and freezes the row afterwards, so the reason has to
-- travel in the same UPDATE that cancels. The constraint below keeps it
-- from being set on any event that is not cancelled.
alter table public.events
  add column cancel_reason text
    constraint events_cancel_reason_length
    check (cancel_reason is null or length(trim(cancel_reason)) between 1 and 300),
  add constraint events_cancel_reason_only_when_cancelled
    check (cancel_reason is null or status = 'cancelled');
