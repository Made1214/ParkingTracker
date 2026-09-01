-- 019_views.sql
-- MUST use security_invoker = true. Without it, a view runs as its
-- owner (postgres, who owns every table and bypasses RLS), so any
-- member could read every group's data through the view while the
-- underlying tables stay correctly locked down. Supabase ships an
-- ERROR-level advisor lint for exactly this (0010_security_definer_view).
-- Verified: target is Postgres 17.6, security_invoker is available.

create view public.member_participation
with (security_invoker = true) as
select
  gm.group_id,
  gm.user_id,
  p.display_name,
  count(*) filter (where ea.status = 'going')    as events_attended,
  count(*) filter (where ea.status = 'maybe')    as events_maybe,
  count(*) filter (where ea.status = 'declined') as events_declined,
  count(distinct e.id)                           as events_invited,
  round(
    100.0 * count(*) filter (where ea.status = 'going')
    / nullif(count(distinct e.id), 0), 1)        as attendance_pct
from public.group_members gm
join public.profiles p on p.id = gm.user_id
left join public.events e
       on e.group_id = gm.group_id and e.status in ('published', 'finished')
left join public.event_attendance ea
       on ea.event_id = e.id and ea.user_id = gm.user_id
group by gm.group_id, gm.user_id, p.display_name;

create view public.event_expense_summary
with (security_invoker = true) as
select
  e.group_id,
  e.id            as event_id,
  e.title,
  e.starts_at,
  count(distinct x.id)              as expense_count,
  coalesce(sum(x.amount), 0)        as total_amount,
  count(distinct s.user_id)         as participant_count,
  coalesce(sum(x.amount) filter (where not exists (
      select 1 from public.expense_splits s2
      where s2.expense_id = x.id and not s2.settled)), 0) as settled_amount
from public.events e
left join public.expenses x       on x.event_id = e.id
left join public.expense_splits s on s.expense_id = x.id
group by e.group_id, e.id, e.title, e.starts_at;

revoke all on public.member_participation, public.event_expense_summary from public, anon;
grant select on public.member_participation, public.event_expense_summary to authenticated;
