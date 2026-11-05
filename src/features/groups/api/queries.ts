import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
export async function listGroups() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar tus grupos.");
  return { groups: data, user };
}
export async function getGroup(groupId: string) {
  const { supabase, user } = await requireUser(`/groups/${groupId}`);
  if (!z.uuid().safeParse(groupId).success) notFound();
  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el grupo.");
  if (!group) notFound();
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, role, profiles(display_name)")
    .eq("group_id", groupId);
  if (membersError) throw new Error("No se pudieron cargar los miembros.");
  return { group, members, user };
}
