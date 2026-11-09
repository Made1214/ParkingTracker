"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { databaseError, text, type ActionState } from "@/shared/lib/forms";

const ids = z.object({ group_id: z.guid(), event_id: z.guid() });
const body = z.string().trim().min(1).max(2000);
const BODY_ERROR = "Escribe un comentario de hasta 2000 caracteres.";

function parseIds(form: FormData) {
  const parsed = ids.safeParse({
    group_id: text(form, "group_id"),
    event_id: text(form, "event_id"),
  });
  return parsed.success ? parsed.data : null;
}
const path = (ctx: { group_id: string; event_id: string }) =>
  `/groups/${ctx.group_id}/events/${ctx.event_id}`;

export async function createComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = parseIds(form);
  if (!ctx) return { error: "No se pudo identificar la salida." };
  const parsedBody = body.safeParse(text(form, "body"));
  if (!parsedBody.success) return { error: BODY_ERROR };
  const parent = text(form, "parent_id");
  if (parent && !z.guid().safeParse(parent).success)
    return { error: "No se pudo identificar el comentario." };
  const { supabase, user } = await requireUser();
  // RLS exige membresía vigente y autoría propia; la base rechaza respuestas anidadas.
  const { error } = await supabase.from("comments").insert({
    ...ctx,
    body: parsedBody.data,
    parent_id: parent || null,
    author_id: user.id,
  });
  if (error)
    return {
      error:
        error.code === "23503"
          ? "Ese comentario ya no existe."
          : databaseError(error.code),
    };
  revalidatePath(path(ctx));
  return {};
}

export async function updateComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = parseIds(form);
  const id = text(form, "id");
  if (!ctx || !z.guid().safeParse(id).success)
    return { error: "No se pudo identificar el comentario." };
  const parsedBody = body.safeParse(text(form, "body"));
  if (!parsedBody.success) return { error: BODY_ERROR };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("comments")
    .update({ body: parsedBody.data })
    .eq("id", id)
    .eq("group_id", ctx.group_id)
    .eq("event_id", ctx.event_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data) return { error: "Solo puedes editar tus propios comentarios." };
  revalidatePath(path(ctx));
  return { success: "Comentario actualizado." };
}

export async function deleteComment(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = parseIds(form);
  const id = text(form, "id");
  if (!ctx || !z.guid().safeParse(id).success)
    return { error: "No se pudo identificar el comentario." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("comments")
    .delete()
    .eq("id", id)
    .eq("group_id", ctx.group_id)
    .eq("event_id", ctx.event_id)
    .select("id")
    .maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data)
    return { error: "No tienes permiso para eliminar este comentario." };
  revalidatePath(path(ctx));
  return {};
}
