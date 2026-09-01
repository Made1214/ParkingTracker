-- 012_polls_and_options.sql
create table public.polls (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null,
  event_id       uuid not null,
  question       text not null check (length(trim(question)) between 1 and 200),
  allow_multiple boolean not null default false,
  closes_at      timestamptz,
  status         public.poll_status not null default 'open',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint polls_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);
alter table public.polls add constraint polls_id_group_uk unique (id, group_id);

alter table public.polls enable row level security;
alter table public.polls force  row level security;

create policy polls_select on public.polls for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy polls_insert on public.polls for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy polls_update on public.polls for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy polls_delete on public.polls for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger polls_set_updated_at
  before update on public.polls
  for each row execute function private.set_updated_at();

create trigger polls_group_id_immutable
  before update of group_id on public.polls
  for each row execute function private.reject_group_id_change();

create index polls_event_id_idx on public.polls (event_id);

-- ---------------------------------------------------------------------

create table public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  poll_id  uuid not null,
  label    text not null check (length(trim(label)) between 1 and 100),
  position integer not null default 0,
  constraint po_poll_fk foreign key (poll_id, group_id)
    references public.polls (id, group_id) on delete cascade,
  constraint po_unique_label unique (poll_id, label)
);
-- Two composite unique keys: (id, group_id) lets poll_votes' own
-- composite FK to poll_options carry the tenant column too if ever
-- needed; (id, poll_id) is what poll_votes actually uses to prove an
-- option belongs to the specific poll being voted on, not merely to the
-- same group.
alter table public.poll_options add constraint po_id_group_uk unique (id, group_id);
alter table public.poll_options add constraint po_id_poll_uk  unique (id, poll_id);

alter table public.poll_options enable row level security;
alter table public.poll_options force  row level security;

create policy poll_options_select on public.poll_options for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy poll_options_insert on public.poll_options for insert to authenticated
  with check ((select private.is_group_admin(group_id)));

create policy poll_options_update on public.poll_options for update to authenticated
  using ((select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy poll_options_delete on public.poll_options for delete to authenticated
  using ((select private.is_group_admin(group_id)));

create trigger poll_options_group_id_immutable
  before update of group_id on public.poll_options
  for each row execute function private.reject_group_id_change();

create index poll_options_poll_id_idx on public.poll_options (poll_id);

-- 2-10 options per poll is a cardinality constraint across sibling rows,
-- which a row-level CHECK cannot express. DEFERRABLE INITIALLY DEFERRED
-- is essential: a poll is created together with its options in one
-- transaction and transiently has fewer than 2. Checked at COMMIT.
create or replace function private.assert_poll_option_arity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_poll_id uuid := coalesce(new.poll_id, old.poll_id);
  v_count   int;
begin
  select count(*) into v_count from public.poll_options where poll_id = v_poll_id;
  if v_count < 2 or v_count > 10 then
    raise exception 'poll % must have between 2 and 10 options (has %)', v_poll_id, v_count
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger poll_options_arity
  after insert or update or delete on public.poll_options
  deferrable initially deferred
  for each row execute function private.assert_poll_option_arity();
