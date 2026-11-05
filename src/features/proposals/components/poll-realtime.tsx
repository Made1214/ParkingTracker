"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/shared/supabase/client";

export function PollRealtime({ groupId }: { groupId: string }) {
  const router = useRouter();
  useEffect(() => {
    const client = browserClient();
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), 250);
    };
    const channel = client
      .channel(`polls:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "polls",
          filter: `group_id=eq.${groupId}`,
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
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") scheduleRefresh();
      });
    const timer = window.setInterval(scheduleRefresh, 30000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [groupId, router]);
  return null;
}
