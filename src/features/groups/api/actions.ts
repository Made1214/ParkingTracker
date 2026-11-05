"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth";
import { text, databaseError, type ActionState } from "@/shared/lib/forms";
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
export async function joinGroup(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const code = text(form, "code").toUpperCase();
  const { supabase } = await requireUser(`/join/${code}`);
  if (!/^[A-Z0-9]{8}$/.test(code))
    return { error: "Escribe el código de 8 caracteres de tu invitación." };
  const { data, error } = await supabase.rpc("join_group_by_invite", {
    p_code: code,
  });
  if (error) return { error: databaseError(error.code) };
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}
