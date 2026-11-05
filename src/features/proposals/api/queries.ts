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
