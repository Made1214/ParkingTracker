begin;
select plan(3);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ),
  'comments is published to Realtime'
);

-- Realtime entrega cada fila según la política SELECT del suscriptor, así que
-- publicar la tabla solo es seguro mientras RLS siga activo y forzado.
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.comments'::regclass),
  'comments keeps RLS enabled and forced'
);

-- Con identidad DEFAULT, un DELETE emite solo la clave primaria: el texto de un
-- comentario borrado nunca viaja por el canal.
select is(
  (select relreplident::text from pg_class where oid = 'public.comments'::regclass),
  'd',
  'comments keeps the default replica identity'
);

select * from finish();
rollback;
