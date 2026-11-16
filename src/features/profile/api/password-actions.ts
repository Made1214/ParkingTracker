"use server";

import { z } from "zod";
import {
  PASSWORD_HINT,
  PASSWORD_MAX,
  isWeakPasswordError,
  passwordProblem,
  requireUser,
} from "@/features/auth";
import { hitRateLimit, peekRateLimit } from "@/shared/lib/rate-limit";
import type { ActionState } from "@/shared/lib/forms";
import {
  FAILED_PASSWORD_CHANGES,
  TOO_MANY_PASSWORD_CHANGES,
} from "./password-limits";

/**
 * Cambia la contraseña con la sesión iniciada. Pide la actual: una sesión
 * robada no basta para quedarse con la cuenta (issue #54).
 */
export async function changePassword(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const fields = z
    .object({
      current: z.string().min(1).max(PASSWORD_MAX),
      password: z.string().min(1).max(PASSWORD_MAX),
      confirm: z.string(),
    })
    .safeParse({
      current: form.get("current_password"),
      password: form.get("password"),
      confirm: form.get("confirm_password"),
    });
  if (!fields.success)
    return { error: "Escribe tu contraseña actual y la nueva." };
  const { current, password, confirm } = fields.data;
  // Lo que no necesita a Supabase se comprueba antes de preguntarle.
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  if (password === current)
    return { error: "La nueva contraseña debe ser distinta de la actual." };

  const { supabase, user } = await requireUser("/profile");
  if (!user.email)
    return { error: "Tu cuenta no tiene una contraseña que cambiar." };

  const gate = await peekRateLimit(user.id, FAILED_PASSWORD_CHANGES);
  if (!gate.allowed) return { error: TOO_MANY_PASSWORD_CHANGES };

  // Reautenticar también deja la sesión recién iniciada, que es lo que exige
  // `secure_password_change` para aceptar el cambio.
  const check = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (check.error) {
    await hitRateLimit(user.id, FAILED_PASSWORD_CHANGES);
    return { error: "La contraseña actual no es correcta." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (isWeakPasswordError(error))
    return { error: `Esa contraseña no es segura. Usa ${PASSWORD_HINT}` };
  if (error)
    return { error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." };

  // Cierra las demás sesiones: si alguien más tenía la cuenta, se queda fuera.
  await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
  return { success: "Tu contraseña se actualizó." };
}
