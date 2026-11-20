"use client";
import { useEventChannel } from "@/shared/supabase/use-event-channel";
import { useRealtimeRefresh } from "@/shared/supabase/use-realtime-refresh";

/** Actualiza los contadores mientras se pueden cambiar las respuestas. */
export function AttendanceRealtime({ eventId }: { eventId: string }) {
  const refresh = useRealtimeRefresh();
  useEventChannel({
    channel: `attendance:${eventId}`,
    table: "event_attendance",
    filter: `event_id=eq.${eventId}`,
    withDeletes: true,
    onChange: (change) => {
      if (change.eventType !== "DELETE" || change.old.event_id === eventId)
        refresh();
    },
    onReconnect: refresh,
  });
  return null;
}
