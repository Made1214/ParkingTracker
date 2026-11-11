-- supabase/seed.sql
-- Development seed data. Loaded ONLY against Staging (or local via
-- `supabase db reset`), never against Prod (see CLAUDE.md).
--
-- Creates: 6 auth.users + profiles, 1 group ("Los de siempre") with all
-- 6 as members (1 admin), 4 events in different states. The finished
-- event is fully populated: attendance, a schedule, a closed poll with
-- votes, expenses with splits (one settled), tasks, photos (dummy
-- Cloudinary public_ids), and comments with one reply.
--
-- Auth.users rows are inserted directly (this file runs with elevated
-- privileges via `db reset`/`db push --include-seed`, not through the
-- app). Passwords are irrelevant for seed data; a fixed dummy hash is
-- used so these accounts are never mistaken for real, usable logins.

begin;

-- ---------------------------------------------------------------------
-- 1. Users (auth.users -> profiles via the on_auth_user_created trigger)
-- ---------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ana@example.com',    crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Torres"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'luis@example.com',   crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Luis Fernández"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sofia@example.com',  crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sofía Ramírez"}',  now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dario@example.com',  crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Darío Gómez"}',    now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'valen@example.com',  crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Valentina Ruiz"}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'nico@example.com',   crypt('devpassword', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nicolás Paz"}',    now(), now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Group ("Los de siempre") — Ana is admin, the other 5 are members
-- ---------------------------------------------------------------------

insert into public.groups (id, name, invite_code, created_by)
values ('10000000-0000-0000-0000-000000000001', 'Los de siempre', 'DEV00001', '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'member'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'member')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Events — one per state (draft / published / cancelled / finished)
-- ---------------------------------------------------------------------

insert into public.events (id, group_id, title, description, location, starts_at, ends_at, status, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Asado de fin de mes', 'Juntada mensual en la casa de Ana', 'Casa de Ana',
   now() + interval '20 days', now() + interval '20 days 5 hours', 'published',
   '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Escapada a la playa', 'Todavía sin confirmar fecha', null,
   now() + interval '45 days', now() + interval '47 days', 'draft',
   '00000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'Cumple de Darío', 'Se canceló por lluvia', 'Salón de fiestas',
   now() - interval '10 days', now() - interval '10 days' + interval '4 hours', 'cancelled',
   '00000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
   'Noche de trivia', 'Salida de bar con trivia temática', 'Bar El Rincón',
   now() - interval '15 days', now() - interval '15 days' + interval '3 hours', 'finished',
   '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Finished event ("Noche de trivia") — fully populated
-- ---------------------------------------------------------------------

-- Attendance: 4 going, 1 maybe, 1 declined
insert into public.event_attendance (group_id, event_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'going'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'going'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'going'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'going'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'maybe'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', 'declined')
on conflict do nothing;

-- Schedule: 3 items
insert into public.schedule_items (group_id, event_id, title, description, starts_at, ends_at, position, created_by) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Llegada y bienvenida', null,
   now() - interval '15 days', now() - interval '15 days' + interval '30 minutes', 0, '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Primera ronda de trivia', 'Categoría: cine',
   now() - interval '15 days' + interval '30 minutes', now() - interval '15 days' + interval '90 minutes', 1, '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Entrega de premios', null,
   now() - interval '15 days' + interval '150 minutes', now() - interval '15 days' + interval '180 minutes', 2, '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Poll: closed, single-choice, with votes
insert into public.polls (id, group_id, event_id, question, allow_multiple, closes_at, status, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
   '¿Qué categoría querés para la próxima trivia?', false, now() - interval '16 days', 'closed',
   '00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.poll_options (id, group_id, poll_id, label, position) values
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Música', 0),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Deportes', 1),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Historia', 2)
on conflict (id) do nothing;

insert into public.poll_votes (group_id, poll_id, option_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000004')
on conflict do nothing;

-- Expenses: 3, with splits (one expense fully settled)
insert into public.expenses (id, group_id, event_id, description, amount, paid_by, created_by) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
   'Ronda de tragos', 60.00, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
   'Picadas', 30.00, '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004',
   'Taxi de vuelta', 15.00, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- Splits for expense 1 (settled) — 4 participants, 15.00 each
insert into public.expense_splits (group_id, expense_id, user_id, share_amount, settled, settled_at) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 15.00, true, now() - interval '14 days'),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 15.00, true, now() - interval '14 days'),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 15.00, true, now() - interval '14 days'),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 15.00, true, now() - interval '14 days')
on conflict do nothing;

-- Splits for expense 2 (unsettled) — 3 participants, 10.00 each
insert into public.expense_splits (group_id, expense_id, user_id, share_amount, settled) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 10.00, false),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10.00, false),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 10.00, false)
on conflict do nothing;

-- Splits for expense 3 (unsettled) — 3 participants, 5.00 each
insert into public.expense_splits (group_id, expense_id, user_id, share_amount, settled) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 5.00, false),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 5.00, false),
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 5.00, false)
on conflict do nothing;

-- Tasks: 2
insert into public.tasks (group_id, event_id, title, assignee_id, status, created_by) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Reservar mesa', '00000000-0000-0000-0000-000000000001', 'done', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Armar preguntas de trivia', '00000000-0000-0000-0000-000000000002', 'done', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Photos: 4 dummy Cloudinary public_ids (no real assets — dev/seed only)
insert into public.photos (group_id, event_id, cloudinary_public_id, bytes, width, height, uploaded_by) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/00000000-0000-4000-8000-000000000001', 245000, 1600, 1200, '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/00000000-0000-4000-8000-000000000002', 198000, 1600, 1200, '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/00000000-0000-4000-8000-000000000003', 312000, 1920, 1080, '00000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'photos/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000004/00000000-0000-4000-8000-000000000004', 276000, 1600, 1200, '00000000-0000-0000-0000-000000000004')
on conflict (cloudinary_public_id) do nothing;

-- Comments: 6, one with a reply (one level of nesting)
insert into public.comments (id, group_id, event_id, parent_id, body, author_id) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', null, '¡Estuvo buenísima la noche!', '00000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', null, 'Sí, repetimos el mes que viene', '00000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'Yo me anoto de nuevo', '00000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', null, 'Las preguntas de cine estuvieron difíciles', '00000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', null, 'Lástima que no pude ir', '00000000-0000-0000-0000-000000000005'),
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', null, 'La próxima no te la perdés', '00000000-0000-0000-0000-000000000006')
on conflict (id) do nothing;

commit;
