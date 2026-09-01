-- 014_expenses_and_splits.sql
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null,
  event_id    uuid not null,
  description text not null check (length(trim(description)) between 1 and 200),
  amount      numeric(12,2) not null check (amount > 0),
  currency    char(3) not null default 'USD',
  -- paid_by is a financial fact, not authorship: ON DELETE RESTRICT
  -- because a balance with an unknown payer is unresolvable arithmetic.
  -- This is a deliberate deviation from the SET NULL rule used elsewhere.
  paid_by     uuid not null references public.profiles(id) on delete restrict,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint exp_event_fk foreign key (event_id, group_id)
    references public.events (id, group_id) on delete cascade
);
alter table public.expenses add constraint expenses_id_group_uk unique (id, group_id);

alter table public.expenses enable row level security;
alter table public.expenses force  row level security;

create policy expenses_select on public.expenses for select to authenticated
  using ((select private.is_group_member(group_id)));

create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select private.is_group_member(group_id)) and created_by = (select auth.uid()));

create policy expenses_update on public.expenses for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy expenses_delete on public.expenses for delete to authenticated
  using (created_by = (select auth.uid()) or (select private.is_group_admin(group_id)));

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function private.set_updated_at();

create trigger expenses_group_id_immutable
  before update of group_id on public.expenses
  for each row execute function private.reject_group_id_change();

create index expenses_event_id_idx on public.expenses (event_id);
create index expenses_paid_by_idx  on public.expenses (paid_by);

-- ---------------------------------------------------------------------

create table public.expense_splits (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null,
  expense_id   uuid not null,
  user_id      uuid not null references public.profiles(id) on delete restrict,
  share_amount numeric(12,2) not null check (share_amount > 0),
  settled      boolean not null default false,
  settled_at   timestamptz,
  constraint es_expense_fk foreign key (expense_id, group_id)
    references public.expenses (id, group_id) on delete cascade,
  constraint es_one_per_user unique (expense_id, user_id),
  constraint es_settled_at check ((settled and settled_at is not null) or (not settled and settled_at is null))
);

alter table public.expense_splits enable row level security;
alter table public.expense_splits force  row level security;

create policy expense_splits_select on public.expense_splits for select to authenticated
  using ((select private.is_group_member(group_id)));

-- Splits are written by the expense creator/admin (allocating shares),
-- but settling a debt is a personal action on your own row.
create policy expense_splits_insert on public.expense_splits for insert to authenticated
  with check (
    (select private.is_group_member(group_id))
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (e.created_by = (select auth.uid()) or (select private.is_group_admin(group_id)))
    )
  );

create policy expense_splits_update on public.expense_splits for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_group_admin(group_id)))
  with check ((select private.is_group_member(group_id)));

create policy expense_splits_delete on public.expense_splits for delete to authenticated
  using ((select private.is_group_admin(group_id)));

create trigger expense_splits_group_id_immutable
  before update of group_id on public.expense_splits
  for each row execute function private.reject_group_id_change();

create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index expense_splits_user_id_idx    on public.expense_splits (user_id);
