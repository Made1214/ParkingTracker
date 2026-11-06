"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { publicEnv } from "@/shared/lib/env";
import { text, type ActionState } from "@/shared/lib/forms";
import { requireUser } from "./session";

export async function requestPasswordReset(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = z.email().safeParse(text(form, "email"));
  if (!email.success) return { error: "Escribe un correo electrónico válido." };
  const supabase = await serverClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv().appUrl}/auth/callback?next=%2Freset-password`,
  });
  if (error)
    return {
      error:
        "No se pudo enviar la solicitud. Espera unos minutos e inténtalo de nuevo.",
    };
  return {
    success:
      "Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Abre el enlace en este mismo navegador.",
  };
}

export async function resetPassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const password = z.string().min(8).max(128).safeParse(form.get("password"));
  if (!password.success)
    return { error: "Usa una contraseña de entre 8 y 128 caracteres." };
  if (password.data !== form.get("confirm_password"))
    return { error: "Las contraseñas no coinciden." };
  const { supabase } = await requireUser("/reset-password");
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error)
    return {
      error:
        "No se pudo cambiar la contraseña. Solicita otro enlace si ha caducado.",
    };
  redirect("/profile?password=updated");
}
