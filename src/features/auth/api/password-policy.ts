/**
 * Reglas de contraseña nuevas (registro y cambio de contraseña). Deben
 * coincidir con Supabase Auth: `minimum_password_length = 10` y
 * `password_requirements = "letters_digits"` en supabase/config.toml y en
 * el panel de cada proyecto (Authentication → Sign In / Providers → Email).
 * El inicio de sesión no las aplica: las cuentas anteriores siguen entrando.
 */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const PASSWORD_HINT = `${PASSWORD_MIN} o más caracteres, con letras y números.`;

/** Qué le falta a una contraseña nueva, o `null` si cumple. */
export function passwordProblem(password: string) {
  const missing: string[] = [];
  if (password.length < PASSWORD_MIN)
    missing.push(`al menos ${PASSWORD_MIN} caracteres`);
  if (!/\p{L}/u.test(password)) missing.push("una letra");
  if (!/\d/.test(password)) missing.push("un número");
  if (password.length > PASSWORD_MAX)
    return `La contraseña admite hasta ${PASSWORD_MAX} caracteres.`;
  if (!missing.length) return null;
  const list =
    missing.length > 1
      ? `${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}`
      : missing[0];
  return `A tu contraseña le falta ${list}.`;
}

/** Supabase rechazó la contraseña por débil (reglas del panel). */
export function isWeakPasswordError(error: { code?: string } | null) {
  return error?.code === "weak_password";
}
