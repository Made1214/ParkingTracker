-- Alinea los permisos de tablas con 000_roles_and_grants.sql (issue #54).
--
-- 000 promete "nothing for anon on the public schema's objects, ever", pero
-- Supabase concede por defecto ALL a anon y authenticated sobre todo lo que
-- crea `postgres` en `public`, y los `alter default privileges` de 000 solo
-- cubren a `authenticated`. Resultado en Staging: anon con DML y TRUNCATE sobre
-- las 16 tablas, y authenticated con TRUNCATE, REFERENCES, TRIGGER y MAINTAIN.
--
-- Hoy no es explotable (RLS forzado y PostgREST no expone TRUNCATE), pero
-- TRUNCATE no pasa por RLS: dejarlo concedido deja a RLS como única barrera.
--
-- No se tocan SELECT/INSERT/UPDATE/DELETE de authenticated: varias tablas los
-- restringen a propósito (polls, poll_votes, activity_proposals solo por RPC;
-- comments solo UPDATE (body)).

-- Objetos existentes.
revoke usage on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke truncate, references, trigger, maintain
  on all tables in schema public from authenticated;

-- Objetos futuros creados por `postgres` (el rol de las migraciones).
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all on functions from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;
