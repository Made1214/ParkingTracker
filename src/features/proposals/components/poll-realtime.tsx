"use client";
import { useEventChannel } from "@/shared/supabase/use-event-channel";
import { useRealtimeRefresh } from "@/shared/supabase/use-realtime-refresh";

/** Actualiza las votaciones de la salida sin volver a suscribirse al cambiar los datos. */
export function PollRealtime({
  groupId,
  eventId,
  pollIds,
  refreshAt,
  open,
}: {
  groupId: string;
  eventId: string;
  pollIds: string;
  refreshAt?: number;
  open: boolean;
}) {
  const refresh = useRealtimeRefresh(open, refreshAt);
  const visiblePolls = new Set(pollIds.split(","));
  useEventChannel({
    channel: `polls:${eventId}`,
    table: "polls",
    filter: `event_id=eq.${eventId}`,
    enabled: open,
    withDeletes: true,
    onChange: (change) => {
      if (
        change.eventType !== "DELETE" ||
        visiblePolls.has(String(change.old.id))
      )
        refresh();
    },
    onReconnect: refresh,
  });
  useEventChannel({
    channel: `votes:${eventId}`,
    table: "poll_votes",
    filter: `group_id=eq.${groupId}`,
    enabled: open,
    onChange: (change) => {
      if (
        change.eventType === "INSERT" &&
        visiblePolls.has(String(change.new.poll_id))
      )
        refresh();
    },
    onReconnect: refresh,
  });
  return null;
}
