-- Realtime para comentarios (fase 14).
--
-- Los cambios de `comments` se publican por Supabase Realtime para que el hilo
-- de una salida se actualice sin recargar. Realtime evalúa la política SELECT
-- de la tabla (`is_group_member(group_id)`) con el JWT de cada suscriptor antes
-- de entregar una fila, así que RLS sigue siendo la única frontera: quien no
-- pertenece al grupo no recibe nada.
--
-- La identidad de réplica se queda en DEFAULT a propósito: un DELETE emite solo
-- la clave primaria, nunca el texto del comentario borrado.

alter publication supabase_realtime add table public.comments;
