"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, type ActionState } from "@/shared/lib/forms";
import { imageValidationError } from "@/shared/lib/images";
import {
  deletePrivateImage,
  mediaConfigured,
  uploadPrivateImage,
} from "@/shared/cloudinary/server";

export async function updateProfile(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      display_name: z.string().trim().min(1).max(80),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9_]{3,24}$/),
    })
    .safeParse({
      display_name: text(form, "display_name"),
      username: text(form, "username"),
    });
  if (!parsed.success)
    return {
      error:
        "Revisa tu nombre y usa un usuario de 3 a 24 letras, números o guiones bajos.",
    };
  const { supabase, user } = await requireUser("/profile");
  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505")
    return { error: "Ese nombre de usuario ya está en uso. Prueba con otro." };
  if (error || !data)
    return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." };
  revalidatePath("/", "layout");
  return { success: "Perfil actualizado." };
}

export async function updateAvatar(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser("/profile");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("avatar_public_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) return { error: "No se pudo cargar tu perfil." };
  if (!mediaConfigured())
    return {
      error:
        "La subida de imágenes aún no está disponible. Inténtalo más tarde.",
    };
  const remove = text(form, "remove") === "true";
  const file = form.get("avatar");
  if (!remove) {
    if (!(file instanceof File)) return { error: "Selecciona una imagen." };
    const validationError = imageValidationError(file);
    if (validationError) return { error: validationError };
  }
  let publicId: string | null = null;
  try {
    if (!remove && file instanceof File) {
      publicId = `profiles/${user.id}/${randomUUID()}`;
      await uploadPrivateImage(file, publicId);
    }
    let query = supabase
      .from("profiles")
      .update({ avatar_public_id: publicId })
      .eq("id", user.id);
    query = profile.avatar_public_id
      ? query.eq("avatar_public_id", profile.avatar_public_id)
      : query.is("avatar_public_id", null);
    const { data: saved, error: saveError } = await query
      .select("id")
      .maybeSingle();
    if (saveError || !saved) {
      if (publicId)
        await deletePrivateImage(publicId).catch(() =>
          console.error("Failed to clean up an uncommitted avatar"),
        );
      return { error: "Tu perfil cambió. Recarga e inténtalo de nuevo." };
    }
    if (profile.avatar_public_id)
      await deletePrivateImage(profile.avatar_public_id).catch(() =>
        console.error("Failed to clean up a replaced avatar"),
      );
  } catch {
    return { error: "No se pudo guardar tu imagen. Inténtalo de nuevo." };
  }
  revalidatePath("/profile");
  return { success: remove ? "Imagen eliminada." : "Imagen actualizada." };
}
