alter table public.profiles
  add column username text unique,
  add column avatar_public_id text,
  add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  add constraint profiles_avatar_scope check (
    avatar_public_id is null or avatar_public_id ~ ('^profiles/' || id::text || '/[0-9a-f-]{36}$')
  );
