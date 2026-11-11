"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, databaseError, type ActionState } from "@/shared/lib/forms";
import { imageValidationError } from "@/shared/lib/images";
import {
  deletePrivateImage,
  mediaConfigured,
  uploadPrivateImage,
} from "@/shared/cloudinary/server";

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/settings`);
  revalidatePath("/groups");
}
async function adminContext(form: FormData) {
  const groupId = text(form, "group_id");
  if (!z.guid().safeParse(groupId).success) return null;
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  return !error && data?.role === "admin" ? { groupId, supabase, user } : null;
}
export async function updateGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext(form);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(2000),
    })
    .safeParse({
      name: text(form, "name"),
      description: text(form, "description"),
    });
  if (!ctx || !parsed.success)
    return {
      error:
        "Revisa el nombre y la descripción; solo un administrador puede editarlos.",
    };
  const { data, error } = await ctx.supabase
    .from("groups")
    .update(parsed.data)
    .eq("id", ctx.groupId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo guardar el grupo." };
  refresh(ctx.groupId);
  return { success: "Grupo actualizado." };
}
export async function regenerateInvite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext(form);
  if (!ctx)
    return { error: "Solo un administrador puede cambiar la invitación." };
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await ctx.supabase
      .from("groups")
      .update({ invite_code: randomBytes(4).toString("hex").toUpperCase() })
      .eq("id", ctx.groupId)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") continue;
    if (error || !data) return { error: "No se pudo generar la invitación." };
    refresh(ctx.groupId);
    return {
      success:
        "Invitación renovada. El código anterior ya no permite nuevas uniones.",
    };
  }
  return { error: "No se pudo generar un código único. Inténtalo de nuevo." };
}
export async function manageMember(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext(form);
  const userId = text(form, "user_id");
  const operation = text(form, "operation");
  if (
    !ctx ||
    !z.guid().safeParse(userId).success ||
    !["remove", "admin", "member"].includes(operation)
  )
    return { error: "No tienes permiso para cambiar esta membresía." };
  const base = ctx.supabase.from("group_members");
  const query =
    operation === "remove"
      ? base.delete()
      : base.update({ role: operation as "admin" | "member" });
  const { data, error } = await query
    .eq("group_id", ctx.groupId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error?.code === "23514")
    return {
      error:
        "El grupo debe conservar al menos un administrador. Nombra a otra persona antes.",
    };
  if (error || !data) return { error: "No se pudo actualizar la membresía." };
  refresh(ctx.groupId);
  if (userId === ctx.user.id && operation === "remove") redirect("/groups");
  return {
    success:
      operation === "remove"
        ? "Miembro eliminado del grupo."
        : "Rol actualizado.",
  };
}
export async function leaveGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const groupId = text(form, "group_id");
  if (!z.guid().safeParse(groupId).success)
    return { error: "No se pudo identificar el grupo." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error?.code === "23514")
    return { error: "Antes de salir, nombra a otro administrador del grupo." };
  if (error || !data) return { error: databaseError(error?.code) };
  revalidatePath("/groups");
  redirect("/groups");
}
export async function deleteGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext(form);
  if (!ctx) return { error: "Solo un administrador puede eliminar el grupo." };
  if (text(form, "confirmation") !== "ELIMINAR")
    return { error: "Escribe ELIMINAR para confirmar la eliminación." };
  const { data, error } = await ctx.supabase.rpc("delete_group", {
    p_group_id: ctx.groupId,
  });
  if (error) return { error: databaseError(error.code) };
  // The rows are already gone; a failed CDN cleanup must not undo that.
  await Promise.allSettled(
    (data ?? []).map((publicId) => deletePrivateImage(publicId)),
  );
  revalidatePath("/groups");
  redirect("/groups");
}
export async function updateGroupAvatar(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await adminContext(form);
  if (!ctx) return { error: "Solo un administrador puede cambiar la imagen." };
  const { data: group, error } = await ctx.supabase
    .from("groups")
    .select("avatar_public_id")
    .eq("id", ctx.groupId)
    .maybeSingle();
  if (error || !group) return { error: "No se pudo cargar el grupo." };
  if (!mediaConfigured())
    return { error: "La subida de imágenes aún no está disponible." };
  const remove = text(form, "remove") === "true";
  const file = form.get("avatar");
  if (!remove) {
    if (!(file instanceof File)) return { error: "Selecciona una imagen." };
    const issue = imageValidationError(file);
    if (issue) return { error: issue };
  }
  let publicId: string | null = null;
  try {
    if (!remove && file instanceof File) {
      publicId = `groups/${ctx.groupId}/${randomUUID()}`;
      await uploadPrivateImage(file, publicId);
    }
    let query = ctx.supabase
      .from("groups")
      .update({ avatar_public_id: publicId })
      .eq("id", ctx.groupId);
    query = group.avatar_public_id
      ? query.eq("avatar_public_id", group.avatar_public_id)
      : query.is("avatar_public_id", null);
    const { data: saved, error: saveError } = await query
      .select("id")
      .maybeSingle();
    if (saveError || !saved) {
      if (publicId)
        await deletePrivateImage(publicId).catch(() =>
          console.error("Uncommitted group avatar cleanup failed"),
        );
      return { error: "El grupo cambió. Recarga e inténtalo de nuevo." };
    }
    if (group.avatar_public_id)
      await deletePrivateImage(group.avatar_public_id).catch(() =>
        console.error("Replaced group avatar cleanup failed"),
      );
  } catch {
    return { error: "No se pudo guardar la imagen del grupo." };
  }
  refresh(ctx.groupId);
  return { success: remove ? "Imagen eliminada." : "Imagen actualizada." };
}
