import "server-only";
import { requireUser } from "@/features/auth";
export async function getAttendance(groupId: string, eventId: string) {
  const { supabase } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  const { data, error } = await supabase
    .from("event_attendance")
    .select("user_id, status, profiles(display_name)")
    .eq("event_id", eventId)
    .eq("group_id", groupId);
  if (error) throw new Error("No se pudo cargar la asistencia.");
  return data;
}
