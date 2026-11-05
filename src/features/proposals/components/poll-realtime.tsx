"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/shared/supabase/client";

export function PollRealtime({ groupId }: { groupId: string }) {
  const router = useRouter();
  useEffect(() => {
    const client = browserClient();
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
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_votes",
          filter: `group_id=eq.${groupId}`,
        },
        () => router.refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") router.refresh();
      });
    const timer = window.setInterval(() => router.refresh(), 30000);
    return () => {
      window.clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, [groupId, router]);
  return null;
}
