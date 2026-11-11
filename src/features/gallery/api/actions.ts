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

const ids = z.object({ group_id: z.guid(), event_id: z.guid() });

export async function uploadPhoto(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  if (!parsed.success) return { error: "No se pudo identificar la salida." };
  const { group_id, event_id } = parsed.data;
  const { supabase, user } = await requireUser();
  // RLS solo devuelve la salida a miembros vigentes del grupo.
  const { data: event, error } = await supabase
    .from("events")
    .select("status")
    .eq("group_id", group_id)
    .eq("id", event_id)
    .maybeSingle();
  if (error || !event) return { error: "No tienes acceso a esta salida." };
  if (event.status !== "published" && event.status !== "finished")
    return { error: "Esta salida no admite fotos." };
  if (!mediaConfigured())
    return {
      error:
        "La subida de imágenes aún no está disponible. Inténtalo más tarde.",
    };
  const file = form.get("photo");
  if (!(file instanceof File)) return { error: "Selecciona una imagen." };
  const validationError = imageValidationError(file);
  if (validationError) return { error: validationError };

  const publicId = `photos/${group_id}/${event_id}/${randomUUID()}`;
  try {
    const uploaded = await uploadPrivateImage(file, publicId, {
      width: 1600,
      height: 1600,
    });
    const bytes = Number(uploaded.bytes);
    const width = Number(uploaded.width);
    const height = Number(uploaded.height);
    if (
      !Number.isInteger(bytes) ||
      bytes <= 0 ||
      bytes > 10 * 1024 * 1024 ||
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      await deletePrivateImage(publicId).catch(() =>
        console.error("Failed to clean up an invalid uploaded photo"),
      );
      return { error: "No se pudo verificar la imagen subida." };
    }
    const { error: insertError } = await supabase.from("photos").insert({
      group_id,
      event_id,
      cloudinary_public_id: publicId,
      cloudinary_version: String(uploaded.version),
      bytes,
      width,
      height,
      uploaded_by: user.id,
    });
    if (insertError) {
      await deletePrivateImage(publicId).catch(() =>
        console.error("Failed to clean up an uncommitted photo"),
      );
      return {
        error:
          insertError.code === "53100"
            ? "El grupo llegó a su límite de almacenamiento de fotos."
            : "No se pudo guardar la foto. Inténtalo de nuevo.",
      };
    }
  } catch {
    return { error: "No se pudo subir la foto. Inténtalo de nuevo." };
  }
  revalidatePath(`/groups/${group_id}/events/${event_id}`);
  return { success: "Foto añadida." };
}

export async function deletePhoto(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  const id = text(form, "id");
  if (!parsed.success || !z.guid().safeParse(id).success)
    return { error: "No se pudo identificar la foto." };
  const { group_id, event_id } = parsed.data;
  const { supabase } = await requireUser();
  // RLS: solo quien la subió o un admin puede borrarla.
  const { data, error } = await supabase
    .from("photos")
    .delete()
    .eq("id", id)
    .eq("group_id", group_id)
    .eq("event_id", event_id)
    .select("cloudinary_public_id")
    .maybeSingle();
  if (error || !data)
    return { error: "No tienes permiso para eliminar esta foto." };
  if (mediaConfigured())
    await deletePrivateImage(data.cloudinary_public_id).catch(() =>
      console.error("Failed to clean up a deleted photo"),
    );
  revalidatePath(`/groups/${group_id}/events/${event_id}`);
  return { success: "Foto eliminada." };
}
