-- 000_roles_and_grants.sql
-- Baseline grants for PostgREST-facing roles. The app connects only as
-- `anon` (unauthenticated) or `authenticated` (via the user's JWT).
-- `service_role` and `postgres` are never used by application code.

-- Dedicated schema for privileged helper functions (SECURITY DEFINER).
-- Kept out of `public` so PostgREST never exposes them as RPC endpoints
-- by accident, and so `search_path` confusion can't reach them via a
-- schema an attacker controls.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- Nothing for anon on the public schema's objects, ever. Membership in a
-- group is required to see anything; anon has no group.
revoke all on schema public from anon;
grant usage on schema public to authenticated;

-- Postgres' default function ACL is EXECUTE TO PUBLIC. Kill it globally,
-- then grant back explicitly per function as each one is created.
alter default privileges in schema public revoke execute on functions from public;
revoke execute on all functions in schema public from public;

alter default privileges in schema private revoke execute on functions from public;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Table DML for authenticated; RLS narrows every row after this grant.
-- This is deliberate: one authorization authority (RLS), not two.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
