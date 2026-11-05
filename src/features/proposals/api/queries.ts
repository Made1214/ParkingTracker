import "server-only";
import { requireUser } from "@/features/auth";

export async function getProposals(groupId: string, eventId: string) {
  const { supabase } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const { data, error } = await supabase
    .from("activity_proposals")
    .select("id, title, description, created_at, profiles(display_name)")
    .eq("group_id", groupId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las propuestas.");
  return data;
}

export async function getPolls(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser();
  const [{ data, error }, { data: member, error: memberError }] =
    await Promise.all([
      supabase
        .from("polls")
        .select(
          "*, poll_options(id,label,position), poll_votes(option_id,user_id)",
        )
        .eq("group_id", groupId)
        .eq("poll_votes.user_id", user.id)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (error || memberError)
    throw new Error("No se pudieron cargar las votaciones.");
  const results = await Promise.all(
    data.map(async (poll) => {
      const { data: counts, error: countsError } = await supabase.rpc(
        "get_poll_results",
        { p_poll_id: poll.id },
      );
      if (countsError) throw new Error("No se pudieron cargar los resultados.");
      return { ...poll, results: counts };
    }),
  );
  return {
    polls: results,
    userId: user.id,
    isAdmin: member?.role === "admin",
    now: Date.now(),
  };
}
