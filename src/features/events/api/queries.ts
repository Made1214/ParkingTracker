import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
export async function listEvents(groupId: string) {
  const { supabase } = await requireUser(`/groups/${groupId}`);
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_at");
  if (error) throw new Error("No se pudieron cargar los eventos.");
  return data;
}
export async function getEvent(groupId: string, eventId: string) {
  const { supabase, user } = await requireUser(
    `/groups/${groupId}/events/${eventId}`,
  );
  if (
    !z.uuid().safeParse(groupId).success ||
    !z.uuid().safeParse(eventId).success
  )
    notFound();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el evento.");
  if (!data) notFound();
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    throw new Error("No se pudieron comprobar los permisos del evento.");
  return {
    event: data,
    user,
    canManage:
      (data.created_by === user.id || membership?.role === "admin") &&
      data.status === "published" &&
      Date.parse(data.starts_at) > Date.now(),
    canRespond:
      data.status === "published" && Date.parse(data.starts_at) > Date.now(),
  };
}
