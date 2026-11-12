import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { serverClient } from "@/shared/supabase/server";
export async function listGroups() {
  const { supabase, user } = await requireUser();
  const [groups, profile] = await Promise.all([
    supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (groups.error || profile.error)
    throw new Error("No se pudieron cargar tus grupos.");
  return {
    groups: groups.data,
    user,
    displayName: profile.data?.display_name ?? "",
  };
}
export async function getGroup(groupId: string) {
  const { supabase, user } = await requireUser(`/groups/${groupId}`);
  if (!z.guid().safeParse(groupId).success) notFound();
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
/** Datos de la navegación: grupos y nombre. null si no hay sesión. */
export async function getShellData() {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [groups, profile] = await Promise.all([
    supabase.from("groups").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  return {
    groups: groups.data ?? [],
    displayName: profile.data?.display_name ?? "",
  };
}

/**
 * Lo que se ve de un grupo antes de aceptar su invitación (plan E3.F2.T1):
 * nombre, descripción y tamaño. `null` si el código no existe o no tiene
 * el formato de 8 caracteres.
 */
export async function getInvitePreview(code: string) {
  const normalized = code.trim().toUpperCase();
  const { supabase } = await requireUser(`/join/${encodeURIComponent(code)}`);
  if (!/^[A-Z0-9]{8}$/.test(normalized)) return null;
  const { data, error } = await supabase.rpc("get_invite_preview", {
    p_code: normalized,
  });
  if (error) throw new Error("No se pudo comprobar la invitación.");
  const group = data[0];
  return group
    ? {
        code: normalized,
        groupId: group.group_id,
        name: group.name,
        description: group.description,
        memberCount: group.member_count,
        alreadyMember: group.already_member,
      }
    : null;
}
