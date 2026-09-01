-- 003_core_tables.sql
-- profiles, groups, group_members created WITHOUT RLS yet. The
-- SECURITY DEFINER helper functions (004_helper_functions.sql) read
-- group_members and, being `language sql`, have their table references
-- validated at CREATE FUNCTION time -- so group_members must exist
-- first. RLS + policies for these three tables land in
-- 005_core_rls.sql, right after the helpers exist. No table is
-- reachable by `authenticated` in between: default privileges only
-- grant DML, and RLS is not yet enabled, which for a table with RLS
-- disabled means "no policies exist" -- but the grant is already
-- narrow (authenticated only, never anon) and this entire migration
-- sequence runs as one deploy before any real user exists.

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 80),
  photo_url   text,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index groups_invite_code_idx on public.groups (invite_code);

-- THE HINGE. Every RLS policy in this schema reduces to a lookup here.
create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- PK (group_id, user_id) gives an idempotent join via ON CONFLICT DO
-- NOTHING and is the exact index is_group_member()/is_group_admin() probe.
create index group_members_user_id_idx on public.group_members (user_id);
