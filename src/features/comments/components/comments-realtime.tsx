"use client";
import { useEventChannel } from "@/shared/supabase/use-event-channel";
import { useRealtimeRefresh } from "@/shared/supabase/use-realtime-refresh";

/** Actualiza los comentarios y filtra los avisos de borrados de otros hilos. */
export function CommentsRealtime({
  eventId,
  commentIds,
}: {
  eventId: string;
  commentIds: string;
}) {
  const refresh = useRealtimeRefresh();
  const visible = new Set(commentIds.split(","));
  useEventChannel({
    channel: `comments:${eventId}`,
    table: "comments",
    filter: `event_id=eq.${eventId}`,
    withDeletes: true,
    onChange: (change) => {
      if (change.eventType !== "DELETE" || visible.has(String(change.old.id)))
        refresh();
    },
    onReconnect: refresh,
  });
  return null;
}
