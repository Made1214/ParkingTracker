import "server-only";
import { requireUser } from "@/features/auth";

export async function getTasks(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser();
  const [tasks, members] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at"),
    supabase
      .from("group_members")
      .select("user_id, role, profiles(display_name)")
      .eq("group_id", groupId),
  ]);
  if (tasks.error || members.error)
    throw new Error("No se pudieron cargar las tareas.");
  return { tasks: tasks.data, members: members.data, user };
}

/** Progreso de tareas de una salida para el resumen del plan. */
export async function getTaskProgress(groupId: string, eventId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select("status")
    .eq("group_id", groupId)
    .eq("event_id", eventId);
  if (error) throw new Error("No se pudieron cargar las tareas.");
  return {
    done: data.filter((task) => task.status === "done").length,
    total: data.length,
  };
}
