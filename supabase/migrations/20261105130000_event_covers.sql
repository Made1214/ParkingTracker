alter table public.events add column cover_public_id text;
-- An editor cannot point the delivery endpoint at an asset belonging to another tenant/event.
alter table public.events add constraint events_cover_scope check (
  cover_public_id is null or cover_public_id ~ (
    '^events/' || group_id::text || '/' || id::text || '/[0-9a-f-]{36}$'
  )
);
