"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, databaseError, type ActionState } from "@/shared/lib/forms";
import { hitRateLimit } from "@/shared/lib/rate-limit";
export async function createGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = text(form, "name");
  if (!z.string().min(1).max(80).safeParse(name).success)
    return { error: "El nombre debe tener entre 1 y 80 caracteres." };
  const { data, error } = await supabase.rpc("create_group", { p_name: name });
  if (error) return { error: databaseError(error.code) };
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}
// Canjea la invitación y abre el grupo cuando se confirma la membresía.
export async function joinGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const code = text(form, "code").toUpperCase();
  const { supabase, user } = await requireUser(`/join/${code}`);
  if (!/^[A-Z0-9]{8}$/.test(code))
    return { error: "Escribe el código de 8 caracteres de tu invitación." };
  const limit = await hitRateLimit(user.id, {
    scope: "invite-join",
    limit: 10,
  });
  if (!limit.allowed)
    return {
      error: "Demasiados intentos de invitación. Inténtalo en un minuto.",
    };
  const { data, error } = await supabase.rpc("join_group_by_invite", {
    p_code: code,
  });
  if (error?.code === "P0002")
    return { error: "El código de invitación no es válido." };
  if (error) return { error: databaseError(error.code) };
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}
