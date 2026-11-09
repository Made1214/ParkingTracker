"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { type ActionState, text } from "@/shared/lib/forms";
import { imageValidationError } from "@/shared/lib/images";
import {
  deletePrivateImage,
  mediaConfigured,
  uploadPrivateImage,
} from "@/shared/cloudinary/server";

export async function updateEventCover(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ids = z.object({ group_id: z.uuid(), event_id: z.uuid() }).safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!ids.success) return { error: "No se pudo identificar el evento." };
  const { supabase, user } = await requireUser();
  const { group_id, event_id } = ids.data;
  const [{ data: event, error }, { data: member, error: memberError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("created_by, status, starts_at, cover_public_id")
        .eq("group_id", group_id)
        .eq("id", event_id)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("role")
        .eq("group_id", group_id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (
    error ||
    memberError ||
    !event ||
    !member ||
    (event.created_by !== user.id && member.role !== "admin") ||
    !["draft", "published"].includes(event.status) ||
    (event.status === "published" && Date.parse(event.starts_at) <= Date.now())
  )
    return {
      error: "No tienes permiso para cambiar la portada de este evento.",
    };
  const remove = text(form, "remove") === "true";
  if (!mediaConfigured())
    return {
      error:
        "La subida de imágenes aún no está disponible. Inténtalo más tarde.",
    };
  const file = form.get("cover");
  if (!remove) {
    if (!(file instanceof File)) return { error: "Selecciona una imagen." };
    const validationError = imageValidationError(file);
    if (validationError) return { error: validationError };
  }
  let publicId: string | null = null;
  try {
    if (!remove && file instanceof File) {
      publicId = `events/${group_id}/${event_id}/${randomUUID()}`;
      await uploadPrivateImage(file, publicId);
    }
    let query = supabase
      .from("events")
      .update({ cover_public_id: publicId })
      .eq("id", event_id)
      .eq("group_id", group_id);
    query = event.cover_public_id
      ? query.eq("cover_public_id", event.cover_public_id)
      : query.is("cover_public_id", null);
    const { data: saved, error: saveError } = await query
      .select("id")
      .maybeSingle();
    if (saveError || !saved) {
      if (publicId)
        await deletePrivateImage(publicId).catch(() =>
          console.error("Failed to clean up an uncommitted cover"),
        );
      return {
        error:
          "El evento cambió o ya no puedes editarlo. Recarga e inténtalo de nuevo.",
      };
    }
    if (event.cover_public_id)
      await deletePrivateImage(event.cover_public_id).catch(() =>
        console.error("Failed to clean up a replaced cover"),
      );
  } catch {
    return { error: "No se pudo guardar la portada. Inténtalo de nuevo." };
  }
  revalidatePath(`/groups/${group_id}/events/${event_id}`);
  return { success: remove ? "Portada eliminada." : "Portada actualizada." };
}
