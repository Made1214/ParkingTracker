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
  return {
    event: data,
    user,
    canRespond:
      data.status === "published" && Date.parse(data.starts_at) > Date.now(),
  };
}
