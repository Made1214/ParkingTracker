begin;
select plan(24);

-- Luis (2) organiza; Sofía (3) y Darío (4) son miembros. Externo (ff) no.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ff', 'externo@example.com');
insert into public.events (id, group_id, title, starts_at, ends_at, status, created_by) values
  ('90000000-0000-0000-0000-000000000341', '10000000-0000-0000-0000-000000000001', 'Cena',
   now() + interval '1 day', now() + interval '1 day 4 hours', 'published', '00000000-0000-0000-0000-000000000002'),
  ('90000000-0000-0000-0000-000000000342', '10000000-0000-0000-0000-000000000001', 'Otra',
   now() + interval '2 day', now() + interval '2 day 4 hours', 'published', '00000000-0000-0000-0000-000000000002');

-- Ejecuta un SQL y fuerza las comprobaciones diferidas dentro de la misma
-- subtransacción, para que un fallo no deje nada a medias.
create function pg_temp.commit_check(p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  set constraints all immediate;
  set constraints all deferred;
end $$;
grant execute on function pg_temp.commit_check(text) to authenticated;
create function pg_temp.affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function pg_temp.affected(text) to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

-- Invitados -------------------------------------------------------------
select lives_ok($$insert into public.event_guests (id, group_id, event_id, display_name, created_by) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '90000000-0000-0000-0000-000000000341', 'Pedro', '00000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '90000000-0000-0000-0000-000000000342', 'Marta', '00000000-0000-0000-0000-000000000002')$$,
  'a member adds guests to an event');
select throws_ok($$insert into public.event_guests (group_id, event_id, display_name, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000341', ' pedro ',
   '00000000-0000-0000-0000-000000000002')$$, '23505', null, 'guest names are unique per event, ignoring case');

-- Borrador ----------------------------------------------------------------
select lives_ok($$insert into public.receipts (id, group_id, event_id, created_by, document) values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '90000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-000000000002', '{"items":[]}')$$,
  'a member creates a draft receipt');
select throws_ok($$update public.receipts set merchant = 'X' where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '40001', 'receipt version conflict', 'a draft save must bump the version (optimistic locking)');
select lives_ok($$update public.receipts set merchant = 'La Fonda', version = 2
  where id = 'b0000000-0000-0000-0000-000000000001' and version = 1$$, 'a draft saves with the next version');
select throws_ok($$insert into public.receipts (group_id, event_id, created_by, image_public_id) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000341',
   '00000000-0000-0000-0000-000000000002', 'events/otro/foto')$$, '23514', null,
  'receipt images must live under the receipt event folder');

-- Finalizar -----------------------------------------------------------------
-- Total 90.00: Luis pagó 60.00 y Sofía 30.00. Consumo: Luis 20, Sofía 25,
-- Darío 30, Pedro (invitado) 15.
select throws_ok($$select pg_temp.commit_check($q$select public.finalize_receipt(
  'b0000000-0000-0000-0000-000000000001', 2, 9100, 'La Fonda', current_date, '{}', '{"people":[]}',
  '[{"paid_by":"00000000-0000-0000-0000-000000000002","amount_cents":9000,
     "splits":[{"user_id":"00000000-0000-0000-0000-000000000002","amount_cents":9000}]}]')$q$)$$,
  '23514', 'receipt expenses must add up to its total', 'expenses must add up to the printed total');
select lives_ok($$select pg_temp.commit_check($q$select public.finalize_receipt(
  'b0000000-0000-0000-0000-000000000001', 2, 9000, 'La Fonda', current_date, '{}', '{"people":[]}',
  '[{"paid_by":"00000000-0000-0000-0000-000000000002","amount_cents":6000,
     "splits":[{"user_id":"00000000-0000-0000-0000-000000000002","amount_cents":2000},
               {"user_id":"00000000-0000-0000-0000-000000000004","amount_cents":2500}],
     "guest_shares":[{"guest_id":"a0000000-0000-0000-0000-000000000001","amount_cents":1500}]},
    {"paid_by":"00000000-0000-0000-0000-000000000003","amount_cents":3000,
     "splits":[{"user_id":"00000000-0000-0000-0000-000000000003","amount_cents":2500},
               {"user_id":"00000000-0000-0000-0000-000000000004","amount_cents":500}]}]')$q$)$$,
  'a receipt is finalized into one expense per payer');
select is((select count(*)::int from public.expenses where receipt_id = 'b0000000-0000-0000-0000-000000000001'), 2,
  'the receipt created two linked expenses');
select results_eq($$select user_id::text, net_amount from public.get_event_balances('90000000-0000-0000-0000-000000000341') order by 1$$,
  $$values ('00000000-0000-0000-0000-000000000002', 25.00), ('00000000-0000-0000-0000-000000000003', 5.00),
           ('00000000-0000-0000-0000-000000000004', -30.00)$$,
  'member balances come out of the receipt expenses (guest debt is tracked apart)');
select is((select sum(share_amount) from public.expense_guest_shares where guest_id = 'a0000000-0000-0000-0000-000000000001'),
  15.00, 'the guest owes their share to the payer');

-- Inmutabilidad -------------------------------------------------------------
select throws_ok($$update public.receipts set merchant = 'Otro', version = 4
  where id = 'b0000000-0000-0000-0000-000000000001'$$, '23514', 'receipt is finalized',
  'a finalized receipt cannot be edited in place');
select throws_ok($$select pg_temp.commit_check($q$delete from public.expenses where id =
  (select id from public.expenses where receipt_id = 'b0000000-0000-0000-0000-000000000001' limit 1)$q$)$$,
  '23514', 'receipt expenses must add up to its total', 'a receipt expense cannot be deleted by hand');
select throws_ok($$delete from public.receipts where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'a finalized receipt cannot be deleted while it has expenses');
select throws_ok($$insert into public.expense_guest_shares (group_id, expense_id, guest_id, share_amount)
  select group_id, id, 'a0000000-0000-0000-0000-000000000002', 1 from public.expenses
  where receipt_id = 'b0000000-0000-0000-0000-000000000001' limit 1$$,
  '23514', 'guest must belong to the expense event', 'a guest from another event cannot owe on this expense');

-- Cobrar al invitado ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.expense_guest_shares set settled = true, settled_at = now()
  where guest_id = 'a0000000-0000-0000-0000-000000000001'$$), 0,
  'a member who did not pay cannot mark the guest share as collected');
select throws_ok($$update public.expense_guest_shares set share_amount = 1
  where guest_id = 'a0000000-0000-0000-0000-000000000001'$$, '42501', null, 'guest share amounts are not editable');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(pg_temp.affected($$update public.expense_guest_shares set settled = true, settled_at = now()
  where guest_id = 'a0000000-0000-0000-0000-000000000001'$$), 1,
  'the payer marks the guest share as collected');

-- Reabrir ----------------------------------------------------------------
select throws_ok($$select public.reopen_receipt('b0000000-0000-0000-0000-000000000001', 3)$$,
  '23514', 'receipt has settled payments', 'a receipt with collected payments cannot be reopened');
update public.expense_guest_shares set settled = false, settled_at = null
  where guest_id = 'a0000000-0000-0000-0000-000000000001';
select throws_ok($$select public.reopen_receipt('b0000000-0000-0000-0000-000000000001', 2)$$,
  '40001', 'receipt version conflict', 'reopening checks the version');
select lives_ok($$select pg_temp.commit_check($q$select public.reopen_receipt('b0000000-0000-0000-0000-000000000001', 3)$q$)$$,
  'the receipt is reopened for corrections');
select is((select count(*)::int from public.expenses where receipt_id = 'b0000000-0000-0000-0000-000000000001'), 0,
  'reopening removes its expenses and their debts');

-- Aislamiento -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
select is((select count(*)::int from public.receipts) + (select count(*)::int from public.event_guests)
  + (select count(*)::int from public.expense_guest_shares), 0, 'outsiders see no receipts, guests or guest shares');
select throws_ok($$insert into public.receipts (group_id, event_id, created_by) values
  ('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000341', '00000000-0000-0000-0000-0000000000ff')$$,
  '42501', null, 'outsiders cannot create receipts');

select * from finish();
rollback;
