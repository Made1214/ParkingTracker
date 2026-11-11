"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserClient } from "@/shared/supabase/client";

export function PollRealtime({
  groupId,
  eventId,
  pollIds,
  refreshAt,
}: {
  groupId: string;
  eventId: string;
  pollIds: string;
  refreshAt?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const client = browserClient();
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (document.visibilityState === "hidden") return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 250);
    };
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    // El canal debe unirse ya con el JWT de la sesión. Si se une antes de que
    // el cliente termine de leerla, entra como anónimo y RLS descarta todos
    // los avisos sin dar error.
    void client.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        channel = client
          .channel(`polls:${eventId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "polls",
              filter: `event_id=eq.${eventId}`,
            },
            scheduleRefresh,
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "poll_votes",
              filter: `group_id=eq.${groupId}`,
            },
            (payload) => {
              if (pollIds.split(",").includes(String(payload.new.poll_id)))
                scheduleRefresh();
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") scheduleRefresh();
          });
      });
    const timer = window.setInterval(scheduleRefresh, 30000);
    const deadlineTimer = refreshAt
      ? window.setTimeout(
          scheduleRefresh,
          Math.min(Math.max(refreshAt - Date.now() + 100, 0), 2147483647),
        )
      : undefined;
    document.addEventListener("visibilitychange", scheduleRefresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer);
      window.clearTimeout(deadlineTimer);
      document.removeEventListener("visibilitychange", scheduleRefresh);
      if (channel) void client.removeChannel(channel);
    };
  }, [groupId, eventId, pollIds, refreshAt, router]);
  return null;
}
