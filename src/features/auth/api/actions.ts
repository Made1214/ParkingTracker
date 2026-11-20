"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverClient } from "@/shared/supabase/server";
import { publicEnv } from "@/shared/lib/env";
import { clientIp } from "@/shared/lib/client-ip";
import { hitRateLimit, peekRateLimit } from "@/shared/lib/rate-limit";
import {
  FAILED_PER_EMAIL,
  FAILED_PER_IP,
  TOO_MANY_LOGINS,
} from "./login-limits";
import { safeNext } from "@/shared/lib/utils";
import { text, type ActionState } from "@/shared/lib/forms";
import {
  PASSWORD_HINT,
  PASSWORD_MAX,
  isWeakPasswordError,
  passwordProblem,
} from "./password-policy";
// Al entrar solo se exige que haya contraseña: las reglas de longitud y
// caracteres aplican a las nuevas, y las cuentas anteriores deben seguir
// pudiendo entrar con la suya.
const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(PASSWORD_MAX),
});
export async function login(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = credentials.safeParse({
    email: text(form, "email"),
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success)
    return {
      error: "Escribe un correo válido y tu contraseña.",
    };
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(await headers());
  const [byEmail, byIp] = await Promise.all([
    peekRateLimit(email, FAILED_PER_EMAIL),
    peekRateLimit(ip, FAILED_PER_IP),
  ]);
  if (!byEmail.allowed || !byIp.allowed) return { error: TOO_MANY_LOGINS };
  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await Promise.all([
      hitRateLimit(email, FAILED_PER_EMAIL),
      hitRateLimit(ip, FAILED_PER_IP),
    ]);
    return {
      error:
        "No pudimos iniciar sesión. Revisa tus datos y confirma tu correo.",
    };
  }
  redirect(safeNext(form.get("next")));
}
// Valida y limita las solicitudes de registro antes de crear una cuenta.
export async function register(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = credentials
    .extend({ name: z.string().min(1).max(80) })
    .safeParse({
      email: text(form, "email"),
      password: String(form.get("password") ?? ""),
      name: text(form, "name"),
    });
  if (!parsed.success) return { error: "Revisa tu nombre y tu correo." };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };
  const limit = await hitRateLimit(clientIp(await headers()), {
    scope: "signup",
    limit: 10,
  });
  if (!limit.allowed)
    return {
      error:
        "Demasiados registros desde esta conexión. Inténtalo en un minuto.",
    };
  const supabase = await serverClient();
  const next = safeNext(form.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${publicEnv().appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (isWeakPasswordError(error))
    return { error: `Esa contraseña no es segura. Usa ${PASSWORD_HINT}` };
  if (error)
    return {
      error: "No pudimos crear la cuenta. Inténtalo de nuevo en unos minutos.",
    };
  if (data.session) redirect(next);
  return { success: "Revisa tu correo para confirmar tu cuenta y continuar." };
}
export async function googleLogin(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv().appUrl}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}`,
    },
  });
  if (error || !data.url)
    return {
      error: "Google no está disponible. Puedes acceder con tu correo.",
    };
  redirect(data.url);
}
export async function logout() {
  const supabase = await serverClient();
  const { error } = await supabase.auth.signOut();
  if (error)
    throw new Error("No se pudo cerrar la sesión. Inténtalo de nuevo.");
  redirect("/login");
}
