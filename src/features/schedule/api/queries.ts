import "server-only";
import { requireUser } from "@/features/auth";
import { annotateTimeline } from "./timeline";

export async function getSchedule(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const [items, event, membership, proposals] = await Promise.all([
    supabase
      .from("schedule_items")
      .select("id, title, description, starts_at, ends_at, proposal_id")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("starts_at")
      .order("position"),
    supabase
      .from("events")
      .select("starts_at, ends_at, status, created_by")
      .eq("group_id", groupId)
      .eq("id", eventId)
      .single(),
    supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("activity_proposals")
      .select("id, title, description")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .order("created_at"),
  ]);
  if (items.error || event.error || membership.error || proposals.error)
    throw new Error("No se pudo cargar el cronograma.");
  const scheduled = new Set(items.data.map((item) => item.proposal_id));
  return {
    // Hora del servidor: misma marca en servidor y cliente al hidratar.
    items: annotateTimeline(items.data, Date.now()),
    event: event.data,
    // Mismas reglas que private.can_manage_schedule en la base de datos.
    canEdit:
      (event.data.created_by === user.id ||
        membership.data?.role === "admin") &&
      (event.data.status === "draft" || event.data.status === "published") &&
      Date.parse(event.data.ends_at) > Date.now(),
    pendingProposals: proposals.data.filter((p) => !scheduled.has(p.id)),
  };
}
