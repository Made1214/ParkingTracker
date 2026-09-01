-- 009_event_attendance.sql
-- PERSONAL RECORD table: writes additionally require user_id = auth.uid(),
-- otherwise a group member could RSVP on someone else's behalf.
create table public.event_attendance (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  event_id     uuid not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       public.attendance_status not null,
  responded_at timestamptz not null default now(),
  constraint ea_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade,
  constraint ea_one_per_user unique (event_id, user_id)
);

alter table public.event_attendance enable row level security;
alter table public.event_attendance force  row level security;

create policy event_attendance_select on public.event_attendance for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy event_attendance_insert on public.event_attendance for insert to authenticated
  with check ((select private.is_group_member(group_id)) and user_id = (select auth.uid()));

create policy event_attendance_update on public.event_attendance for update to authenticated
  using (user_id = (select auth.uid()))
  with check ((select private.is_group_member(group_id)) and user_id = (select auth.uid()));

create policy event_attendance_delete on public.event_attendance for delete to authenticated
  using (user_id = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger event_attendance_group_id_immutable
  before update of group_id on public.event_attendance
  for each row execute function private.reject_group_id_change();

create index event_attendance_event_id_idx on public.event_attendance (event_id);
create index event_attendance_user_id_idx  on public.event_attendance (user_id);
